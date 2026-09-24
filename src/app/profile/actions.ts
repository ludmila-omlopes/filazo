"use server";

import { lockLibraryGame, setLibraryGameStatus, setLibraryEntryStatus, upsertLibraryCopy } from "@/lib/library-entry";

import { hasProAccess } from "@/lib/account-plans";
import { getPlanAccount, proAccountWhere } from "@/lib/plan-access";
import { ABUSE_LIMITS } from "@/lib/abuse-policy";
import { checkActionAbuse } from "@/lib/abuse-request";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import {
  EntrySource,
  ExternalProvider,
  Prisma,
  UserGameStatus,
} from "@prisma/client";
import { z } from "zod";
import {
  importCsvForUser,
  resolveCatalogGame,
} from "@/lib/catalog";
import { parseCsvColumnMappingJson } from "@/lib/csv-import-mapping";
import { catalogUploadsSchema, csvFits, CATALOG_UPLOAD_REQUEST_MAX_BYTES } from "@/lib/catalog-upload-policy";
import { getIgdbGameById } from "@/lib/igdb";
import { resolveQueueGame } from "@/lib/queue-game";
import {
  connectGogAccountForUser,
  GOG_OAUTH_STATE_COOKIE,
  parseGogRedirectUrl,
} from "@/lib/gog";
import { journalUploadPayloadSchema } from "@/lib/journal-media";
import { recomputeRuleInsightsForUser } from "@/lib/assistant/insight-maintenance";
import { createTranslator } from "@/lib/i18n";
import {
  createJournalEntryForUser,
  deleteJournalEntryForUser,
  importPhotoCatalogForUser,
} from "@/lib/journal";
import { connectPlayStationAccountForUser } from "@/lib/playstation";
import { prisma } from "@/lib/prisma";
import {
  refreshUserGameEntryProviderProgress,
  type ProviderProgressRefreshStatus,
} from "@/lib/provider-progress";
import { getRequestLocale } from "@/lib/request-locale";
import { syncUserReviews } from "@/lib/reviews";
import { getSessionUserId } from "@/lib/session";
import { detectFinishedGamesForUser } from "@/lib/story-completion";
import { runManualPlatformSync } from "@/lib/platform-sync";
import { playStationSyncQueue } from "@/lib/playstation-sync-queue";
import { steamSyncQueue } from "@/lib/steam-sync-queue";
import { saveCalendarStart } from "@/lib/calendar-writes";
import { parseCalendarDate } from "@/lib/calendar-policy";

const importSchema = z.object({
  fileName: z.string().min(1).max(255),
  csvText: z.string().min(1),
  mapping: z.string().min(1).max(16384),
});

const plannedStartDateSchema = z.object({
  entryId: z.string().cuid(),
  plannedStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slug: z.string().trim().min(1).max(180).optional(),
});

const manualPlaytimeSchema = z.object({
  entryId: z.string().cuid(),
  hours: z.coerce.number().int().min(0).max(100000),
  minutes: z.coerce.number().int().min(0).max(59),
  slug: z.string().trim().min(1).max(180),
});

export async function saveManualPlaytimeAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const parsed = manualPlaytimeSchema.safeParse({
    entryId: formData.get("entryId"),
    hours: formData.get("hours"),
    minutes: formData.get("minutes"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return;

  const playtimeMinutes = parsed.data.hours * 60 + parsed.data.minutes;
  const entry = await prisma.userGameEntry.findFirst({
    where: { id: parsed.data.entryId, userId },
    select: { id: true },
  });
  if (!entry) return;

  await prisma.userGameEntry.update({
    where: { id: parsed.data.entryId },
    data: {
      playtimeMinutes,
      playtimeSource: "manual",
      pendingPlaytimeMinutes: null,
      pendingPlaytimeSyncedAt: null,
    },
  });
  revalidatePath(`/games/${parsed.data.slug}`);
  revalidatePath("/profile");
}

const manualStartedAtSchema = z.object({
  entryId: z.string().cuid(),
  manualStartedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slug: z.string().trim().min(1).max(180),
});

export async function saveManualStartedAtAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const parsed = manualStartedAtSchema.safeParse({
    entryId: formData.get("entryId"),
    manualStartedAt: formData.get("manualStartedAt"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return;
  const manualStartedAt = parseCalendarDate(parsed.data.manualStartedAt);
  if (!manualStartedAt || manualStartedAt.getTime() > Date.now()) return;
  await saveCalendarStart(userId, parsed.data.entryId, manualStartedAt);
  revalidatePath(`/games/${parsed.data.slug}`);
  revalidatePath("/profile");
}

const syncedPlaytimeDecisionSchema = z.object({
  decision: z.enum(["accept", "keep"]),
  entryId: z.string().cuid(),
  slug: z.string().trim().min(1).max(180),
});

export async function resolveSyncedPlaytimeAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const parsed = syncedPlaytimeDecisionSchema.safeParse({
    decision: formData.get("decision"),
    entryId: formData.get("entryId"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return;

  const entry = await prisma.userGameEntry.findFirst({
    where: { id: parsed.data.entryId, userId },
    select: { pendingPlaytimeMinutes: true },
  });
  if (!entry || entry.pendingPlaytimeMinutes === null) return;
  await prisma.userGameEntry.update({
    where: { id: parsed.data.entryId },
    data: parsed.data.decision === "accept"
      ? {
          playtimeMinutes: entry.pendingPlaytimeMinutes,
          playtimeSource: "sync",
          pendingPlaytimeMinutes: null,
          pendingPlaytimeSyncedAt: null,
        }
      : {
          pendingPlaytimeMinutes: null,
          pendingPlaytimeSyncedAt: null,
        },
  });
  revalidatePath(`/games/${parsed.data.slug}`);
  revalidatePath("/profile");
}

export async function savePlayingNextDateAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  if (!hasProAccess(await getPlanAccount(userId))) redirect("/account/billing");
  const parsed = plannedStartDateSchema.safeParse({
    entryId: formData.get("entryId"),
    plannedStartDate: formData.get("plannedStartDate"),
    slug: formData.get("slug") || undefined,
  });
  if (!parsed.success) return;

  const plannedStartDate = new Date(`${parsed.data.plannedStartDate}T00:00:00.000Z`);
  const result = await prisma.userGameEntry.updateMany({
    where: {
      id: parsed.data.entryId,
      userId,
      status: UserGameStatus.PLAYING_NEXT,
      user: proAccountWhere(),
    },
    data: { plannedStartDate },
  });
  if (result.count) {
    revalidatePath("/profile");
    if (parsed.data.slug) revalidatePath(`/games/${parsed.data.slug}`);
  }
}

function extractNpssoToken(value: unknown) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) {
    return rawValue;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "npsso" in parsed &&
      typeof parsed.npsso === "string"
    ) {
      return parsed.npsso.trim();
    }
  } catch {
    // The field also accepts the bare token, so invalid JSON is fine here.
  }

  return rawValue
    .replace(/^npsso=/i, "")
    .replace(/^"|"$/g, "")
    .trim();
}

const playStationConnectSchema = z.object({
  npsso: z.preprocess(
    extractNpssoToken,
    z.string().trim().min(32).max(512),
  ),
});

const disconnectProviderSchema = z.enum([
  ExternalProvider.STEAM,
  ExternalProvider.PLAYSTATION,
  ExternalProvider.XBOX,
  ExternalProvider.GOG,
]);

const gogConnectSchema = z.object({
  redirectUrl: z.string().trim().url().max(4096),
});

function getProviderQueryValue(provider: ExternalProvider) {
  return provider.toLowerCase();
}

function parseOptionalEntryId(value: unknown) {
  const entryId = String(value ?? "").trim();
  return entryId || null;
}

const MAX_CURRENT_PLAYING_SLOTS = 100;

const currentPlayingSelectionSchema = z.object({
  entryId: z.preprocess(parseOptionalEntryId, z.string().trim().nullable()),
  slot: z.number().int().min(1).max(MAX_CURRENT_PLAYING_SLOTS),
});

const playingNextSchema = z.object({
  next1EntryId: z.preprocess(parseOptionalEntryId, z.string().trim().nullable()),
  next2EntryId: z.preprocess(parseOptionalEntryId, z.string().trim().nullable()),
  next3EntryId: z.preprocess(parseOptionalEntryId, z.string().trim().nullable()),
});

const playingNextGameSchema = z.object({
  gameId: z.preprocess(parseOptionalEntryId, z.string().trim().min(1).max(128).nullable()),
  igdbId: z.preprocess(
    (value) => value == null || value === "" ? null : value,
    z.coerce.number().int().positive().nullable(),
  ),
  platformName: z.preprocess(
    (value) => {
      const rawValue = String(value ?? "").trim();
      return rawValue || null;
    },
    z.string().trim().min(1).max(120).nullable(),
  ),
  replaceEntryId: z.preprocess(parseOptionalEntryId, z.string().trim().nullable()),
  slot: z.coerce.number().int().min(1).max(3),
  title: z.string().trim().min(1).max(200),
}).refine((value) => Boolean(value.gameId || value.igdbId));

const journalEntrySchema = z.object({
  userGameEntryId: z.string().trim().min(1),
  title: z.string().trim().max(160).optional(),
  body: z.string().trim().max(4000).optional(),
  occurredAt: z.string().trim().optional(),
  slug: z.string().trim().optional(),
  returnTo: z.string().trim().optional(),
});

function parseJournalUpload(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const parsed = journalUploadPayloadSchema.safeParse(JSON.parse(value));
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // The server action returns the normal save error below for malformed input.
  }

  throw new Error("Journal media upload details are invalid.");
}

const deleteJournalEntrySchema = z.object({
  journalEntryId: z.string().trim().min(1),
  slug: z.string().trim().optional(),
  returnTo: z.string().trim().optional(),
});

type CurrentPlayingSelection = {
  slot: number;
  entryId: string | null;
};

type PlayingNextSelection = {
  slot: 1 | 2 | 3;
  entryId: string | null;
};

type CurrentPlayingSaveResult =
  | { ok: true }
  | { ok: false; message: string };

type CurrentPlayingGameActionResult =
  | {
      ok: true;
      gameName: string;
      providerRefreshStatus: ProviderProgressRefreshStatus;
    }
  | { ok: false; message: string };

function parseCurrentPlayingSelections(
  formData: FormData,
): CurrentPlayingSelection[] | null {
  const selectionsBySlot = new Map<number, CurrentPlayingSelection>();

  for (const [key, value] of formData.entries()) {
    const match = /^slot(\d+)EntryId$/.exec(key);
    if (!match) {
      continue;
    }

    const parsed = currentPlayingSelectionSchema.safeParse({
      entryId: value,
      slot: Number(match[1]),
    });

    if (!parsed.success || selectionsBySlot.has(parsed.data.slot)) {
      return null;
    }

    selectionsBySlot.set(parsed.data.slot, parsed.data);
  }

  if ([1, 2, 3].some((slot) => !selectionsBySlot.has(slot))) {
    return null;
  }

  const highestSlot = Math.max(...selectionsBySlot.keys());
  if (selectionsBySlot.size !== highestSlot) {
    return null;
  }

  return [...selectionsBySlot.values()].sort(
    (left, right) => left.slot - right.slot,
  );
}

function parsePlayingNextSelections(
  formData: FormData,
): PlayingNextSelection[] | null {
  const parsed = playingNextSchema.safeParse({
    next1EntryId: formData.get("next1EntryId"),
    next2EntryId: formData.get("next2EntryId"),
    next3EntryId: formData.get("next3EntryId"),
  });

  if (!parsed.success) {
    return null;
  }

  return [
    { slot: 1, entryId: parsed.data.next1EntryId },
    { slot: 2, entryId: parsed.data.next2EntryId },
    { slot: 3, entryId: parsed.data.next3EntryId },
  ];
}

function getSafeReturnPath(value: string | undefined) {
  const path = value?.trim();

  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return null;
  }

  return path;
}

async function demotePlayingEntryToOwned({
  entry,
  tx,
  userId,
}: {
  entry: { id: string; gameId: string; status: UserGameStatus };
  tx: Prisma.TransactionClient;
  userId: string;
}) {
  if (entry.status !== UserGameStatus.PLAYING) {
    return;
  }

  await setLibraryGameStatus(tx, userId, entry.gameId, UserGameStatus.OWNED);
}

async function demotePlayingNextEntryToOwned({
  entry,
  tx,
  userId,
}: {
  entry: {
    id: string;
    gameId: string;
    isPhysicalCopy?: boolean;
    status: UserGameStatus;
    userIntent?: string | null;
  };
  tx: Prisma.TransactionClient;
  userId: string;
}) {
  if (entry.status !== UserGameStatus.PLAYING_NEXT) {
    return;
  }

  await setLibraryGameStatus(tx, userId, entry.gameId,
    entry.userIntent === "needs_purchase" && !entry.isPhysicalCopy ? UserGameStatus.WISHLIST : UserGameStatus.OWNED);
}

async function saveCurrentPlayingSelectionsForUser({
  selections,
  userId,
}: {
  selections: CurrentPlayingSelection[];
  userId: string;
}) {
  const selectedEntryIds = selections
    .map((selection) => selection.entryId)
    .filter((entryId): entryId is string => Boolean(entryId));

  if (new Set(selectedEntryIds).size !== selectedEntryIds.length) {
    throw new Error("Choose different games for Current playing.");
  }

  if (selectedEntryIds.length) {
    const entries = await prisma.userGameEntry.findMany({
      where: {
        id: { in: selectedEntryIds },
        userId,
        status: {
          not: UserGameStatus.WISHLIST,
        },
      },
      select: { id: true, gameId: true },
    });

    if (entries.length !== selectedEntryIds.length || new Set(entries.map(entry => entry.gameId)).size !== entries.length) {
      throw new Error("Only games already on your shelf can be featured.");
    }
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await lockLibraryGame(tx, userId, "shelf-selections");
    const previousPinnedEntries = await tx.userGameEntry.findMany({
      where: {
        userId,
        currentPlayingSlot: {
          not: null,
        },
      },
      select: {
        id: true,
        gameId: true,
        isPhysicalCopy: true,
        status: true,
      },
    });

    await tx.userGameEntry.updateMany({
      where: {
        userId,
        currentPlayingSlot: {
          not: null,
        },
      },
      data: {
        currentPlayingSlot: null,
      },
    });

    const selectedEntryIdSet = new Set(selectedEntryIds);
    for (const entry of previousPinnedEntries) {
      if (!selectedEntryIdSet.has(entry.id)) {
        await demotePlayingEntryToOwned({ entry, tx, userId });
      }
    }

    for (const selection of selections) {
      if (!selection.entryId) {
        continue;
      }

      const entry = await tx.userGameEntry.findFirst({
        where: {
          id: selection.entryId,
          userId,
        },
        select: {
          id: true,
          gameId: true,
          startedAt: true,
          status: true,
        },
      });

      if (!entry) {
        throw new Error("Only games already on your shelf can be featured.");
      }

      await setLibraryGameStatus(tx, userId, entry.gameId, UserGameStatus.PLAYING);

      await tx.userGameEntry.update({
        where: { id: selection.entryId },
        data: {
          abandonedAt: null,
          abandonReason: null,
          activeBacklog: true,
          currentPlayingSlot: selection.slot,
          finishedAt: null,
          finishedSource: null,
          playingNextSlot: null,
          startedAt: entry.startedAt ?? now,
          status: UserGameStatus.PLAYING,
        },
      });
    }
  });
}

async function savePlayingNextSelectionsForUser({
  selections,
  userId,
}: {
  selections: PlayingNextSelection[];
  userId: string;
}) {
  const selectedEntryIds = selections
    .map((selection) => selection.entryId)
    .filter((entryId): entryId is string => Boolean(entryId));

  if (new Set(selectedEntryIds).size !== selectedEntryIds.length) {
    throw new Error("Choose three different games for Playing next.");
  }

  if (selectedEntryIds.length) {
    const entries = await prisma.userGameEntry.findMany({
      where: {
        id: { in: selectedEntryIds },
        userId,
        currentPlayingSlot: null,
        finishedAt: null,
        status: {
          notIn: [UserGameStatus.WISHLIST, UserGameStatus.COMPLETED],
        },
      },
      select: { id: true, gameId: true },
    });

    if (entries.length !== selectedEntryIds.length || new Set(entries.map(entry => entry.gameId)).size !== entries.length) {
      throw new Error("Only unfinished shelf games outside Current playing can be queued.");
    }
  }

  await prisma.$transaction(async (tx) => {
    await lockLibraryGame(tx, userId, "shelf-selections");
    const previousQueuedEntries = await tx.userGameEntry.findMany({
      where: {
        userId,
        OR: [
          { playingNextSlot: { not: null } },
          { status: UserGameStatus.PLAYING_NEXT },
        ],
      },
      select: {
        id: true,
        gameId: true,
        isPhysicalCopy: true,
        status: true,
        userIntent: true,
      },
    });

    await tx.userGameEntry.updateMany({
      where: {
        userId,
        playingNextSlot: {
          not: null,
        },
      },
      data: {
        playingNextSlot: null,
      },
    });

    const selectedEntryIdSet = new Set(selectedEntryIds);
    for (const entry of previousQueuedEntries) {
      if (!selectedEntryIdSet.has(entry.id)) {
        await demotePlayingNextEntryToOwned({ entry, tx, userId });
      }
    }

    for (const selection of selections) {
      if (!selection.entryId) {
        continue;
      }

      const entry = await tx.userGameEntry.findFirst({
        where: {
          id: selection.entryId,
          userId,
          currentPlayingSlot: null,
          finishedAt: null,
          status: {
            notIn: [UserGameStatus.WISHLIST, UserGameStatus.COMPLETED],
          },
        },
        select: {
          id: true,
          gameId: true,
          status: true,
        },
      });

      if (!entry) {
        throw new Error("Only unfinished shelf games outside Current playing can be queued.");
      }

      await setLibraryGameStatus(tx, userId, entry.gameId, UserGameStatus.PLAYING_NEXT);

      await tx.userGameEntry.update({
        where: { id: selection.entryId },
        data: {
          abandonedAt: null,
          abandonReason: null,
          activeBacklog: true,
          currentPlayingSlot: null,
          finishedAt: null,
          finishedSource: null,
          playingNextSlot: selection.slot,
          status: UserGameStatus.PLAYING_NEXT,
        },
      });
    }
  });
}

async function clearCurrentPlayingForUser(userId: string) {
  await prisma.$transaction(async (tx) => {
    await lockLibraryGame(tx, userId, "shelf-selections");
    const currentPlayingEntries = await tx.userGameEntry.findMany({
      where: {
        userId,
        currentPlayingSlot: {
          not: null,
        },
      },
      select: {
        id: true,
        gameId: true,
        status: true,
      },
    });

    await tx.userGameEntry.updateMany({
      where: {
        userId,
        currentPlayingSlot: {
          not: null,
        },
      },
      data: {
        currentPlayingSlot: null,
      },
    });

    for (const entry of currentPlayingEntries) {
      await demotePlayingEntryToOwned({ entry, tx, userId });
    }
  });
}

async function clearPlayingNextForUser(userId: string) {
  await prisma.$transaction(async (tx) => {
    await lockLibraryGame(tx, userId, "shelf-selections");
    const playingNextEntries = await tx.userGameEntry.findMany({
      where: {
        userId,
        OR: [
          { playingNextSlot: { not: null } },
          { status: UserGameStatus.PLAYING_NEXT },
        ],
      },
      select: {
        id: true,
        gameId: true,
        status: true,
        userIntent: true,
      },
    });

    await tx.userGameEntry.updateMany({
      where: {
        userId,
        OR: [
          { playingNextSlot: { not: null } },
          { status: UserGameStatus.PLAYING_NEXT },
        ],
      },
      data: {
        playingNextSlot: null,
      },
    });

    for (const entry of playingNextEntries) {
      await demotePlayingNextEntryToOwned({ entry, tx, userId });
    }
  });
}

async function addPlayingNextGameForUser({
  gameId,
  igdbId,
  platformName,
  replaceEntryId,
  slot,
  userId,
}: {
  gameId: string | null;
  igdbId: number | null;
  platformName: string | null;
  replaceEntryId: string | null;
  slot: 1 | 2 | 3;
  userId: string;
}) {
  const game = await resolveQueueGame({ gameId, igdbId, platformName });
  const queueProvider = game.igdbId ? ExternalProvider.IGDB : null;

  const existingEntries = await prisma.userGameEntry.findMany({
    where: {
      userId,
      gameId: game.id,
    },
    select: {
      currentPlayingSlot: true,
      finishedAt: true,
      gameId: true,
      id: true,
      isPhysicalCopy: true,
      status: true,
      userIntent: true,
      platformName: true,
    },
  });

  if (
    existingEntries.some(
      (entry) =>
        entry.currentPlayingSlot !== null ||
        entry.finishedAt ||
        entry.status === UserGameStatus.COMPLETED,
    )
  ) {
    throw new Error("Finished and Current playing games cannot be queued.");
  }

  const ownedPlayingNextStatuses = new Set<UserGameStatus>([
    UserGameStatus.OWNED,
    UserGameStatus.PLAYING,
    UserGameStatus.BACKLOG,
    UserGameStatus.DROPPED,
  ]);
  const hasOwnedIntent = existingEntries.some(
    (entry) =>
      entry.isPhysicalCopy ||
      (entry.userIntent !== "needs_purchase" &&
        (ownedPlayingNextStatuses.has(entry.status) ||
          entry.status === UserGameStatus.PLAYING_NEXT)),
  );
  const ownedEntry = existingEntries.find(
    (entry) =>
      entry.isPhysicalCopy ||
      (entry.userIntent !== "needs_purchase" &&
        ownedPlayingNextStatuses.has(entry.status)),
  );
  const playingNextEntry = existingEntries.find(
    (entry) => entry.status === UserGameStatus.PLAYING_NEXT,
  );
  const wishlistEntry = existingEntries.find(
    (entry) => entry.status === UserGameStatus.WISHLIST,
  );
  const targetEntry = playingNextEntry ?? ownedEntry ?? wishlistEntry ?? null;
  const needsPurchase = !hasOwnedIntent;

  await prisma.$transaction(async (tx) => {
    await lockLibraryGame(tx, userId, "shelf-selections");
    const currentQueueEntries = await tx.userGameEntry.findMany({
      where: {
        userId,
        status: UserGameStatus.PLAYING_NEXT,
      },
      orderBy: [{ playingNextSlot: "asc" }, { updatedAt: "desc" }],
      distinct: ["gameId"],
      select: {
        gameId: true,
        id: true,
        isPhysicalCopy: true,
        status: true,
        userIntent: true,
      },
    });
    const fallbackReplacement =
      currentQueueEntries.length >= 3
        ? currentQueueEntries[slot - 1] ?? currentQueueEntries[2] ?? null
        : null;
    const entryToReplace =
      (replaceEntryId
        ? currentQueueEntries.find((entry) => entry.id === replaceEntryId)
        : null) ??
      fallbackReplacement;

    await tx.userGameEntry.updateMany({
      where: {
        userId,
        playingNextSlot: slot,
      },
      data: { playingNextSlot: null },
    });

    for (const entry of currentQueueEntries) {
      if (targetEntry && entry.id === targetEntry.id) {
        continue;
      }

      if (entryToReplace && entry.id === entryToReplace.id) {
        await demotePlayingNextEntryToOwned({ entry, tx, userId });
      }
    }

    const playingNextData = {
      abandonedAt: null,
      abandonReason: null,
      activeBacklog: true,
      currentPlayingSlot: null,
      finishedAt: null,
      finishedSource: null,
      platformName: platformName ?? undefined,
      playingNextSlot: slot,
      status: UserGameStatus.PLAYING_NEXT,
      userIntent: needsPurchase ? "needs_purchase" : null,
    } satisfies Prisma.UserGameEntryUpdateInput;

    await tx.userGameEntry.updateMany({ where: { userId, gameId: game.id }, data: { playingNextSlot: null } });
    await upsertLibraryCopy({
      userId, gameId: game.id, status: UserGameStatus.PLAYING_NEXT, explicitStatus: true,
      // Queuing an existing title doesn't represent a new purchase.
      platformName: targetEntry ? targetEntry.platformName : platformName, provider: queueProvider,
      update: { playingNextSlot: slot, userIntent: needsPurchase ? "needs_purchase" : null },
      create: {
        source: EntrySource.MANUAL, provider: queueProvider,
        ...playingNextData,
        rawData: { source: gameId ? "playing-next-catalog-search" : "playing-next-igdb-search", igdbId: game.igdbId, title: game.name },
      },
    }, tx);
  });

  revalidatePath(`/games/${game.slug}`);
}

const manualGameAddSchema = z.object({
  igdbId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  platformName: z.preprocess(
    (value) => {
      const rawValue = String(value ?? "").trim();
      return rawValue || null;
    },
    z.string().trim().min(1).max(120).nullable(),
  ),
  status: z.preprocess(
    (value) => String(value ?? "").trim() || UserGameStatus.PLAYING,
    z
      .nativeEnum(UserGameStatus)
      .refine((status) => status !== UserGameStatus.PLAYING_NEXT),
  ),
  query: z.preprocess(
    (value) => {
      const rawValue = String(value ?? "").trim();
      return rawValue || null;
    },
    z.string().trim().nullable(),
  ),
});

const onboardingSchema = z.object({
  playFrequency: z.string().trim().max(80).optional(),
  playTimes: z.array(z.string().trim().max(40)).max(12),
  platforms: z.array(z.string().trim().max(80)).max(16),
  otherPlatform: z.string().trim().max(120).optional(),
});

type OnboardingAnswers = z.infer<typeof onboardingSchema> & {
  updatedAt?: string;
};

function getExistingOnboardingAnswers(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as OnboardingAnswers;
}

function parseOnboardingStepData(formData: FormData) {
  const step = String(formData.get("step") ?? "");

  if (step === "rhythm") {
    const parsed = onboardingSchema
      .pick({ playFrequency: true, playTimes: true })
      .safeParse({
        playFrequency: String(formData.get("playFrequency") ?? "").trim(),
        playTimes: formData.getAll("playTimes").map(String),
      });

    return parsed.success
      ? ({ ok: true, step, data: parsed.data } as const)
      : ({ ok: false } as const);
  }

  if (step === "platforms") {
    const parsed = onboardingSchema
      .pick({ platforms: true, otherPlatform: true })
      .safeParse({
        platforms: formData.getAll("platforms").map(String),
        otherPlatform: String(formData.get("otherPlatform") ?? "").trim(),
      });

    return parsed.success
      ? ({ ok: true, step, data: parsed.data } as const)
      : ({ ok: false } as const);
  }

  return { ok: false } as const;
}

function getNextSetupStep(step: "rhythm" | "platforms") {
  if (step === "rhythm") {
    return "platforms";
  }

  return null;
}

export async function syncSteamLibraryAction() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent(t("profileAction.needSteamLogin"))}`);
  }

  const limitError = await checkActionAbuse([{ name: "manual-steam-sync", limit: 1, windowSeconds: 60 }], userId);
  if (limitError) redirect(`/profile?tab=integrations&error=${encodeURIComponent(limitError)}`);

  let result: Awaited<ReturnType<typeof steamSyncQueue.enqueue>>;
  try {
    result = await steamSyncQueue.enqueue(userId);
  } catch {
    console.warn("Could not enqueue Steam synchronization.");
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(t("profileAction.steamSyncFailed"))}`);
  }
  if (result.kind !== "queued") {
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(t("profileAction.steamSyncFailed"))}`);
  }
  const runId = result.runId;
  after(async () => {
    try {
      if (await steamSyncQueue.drain(runId)) {
        revalidatePath("/profile");
        revalidatePath("/");
      }
    } catch {
      console.warn("Steam worker deferred to the next scheduled tick.");
    }
  });
  revalidatePath("/profile");
  redirect(`/profile?tab=integrations`);
}

export async function disconnectProviderAction(provider: ExternalProvider) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent(t("profileAction.needIntegrationsLogin"))}`);
  }

  const parsed = disconnectProviderSchema.safeParse(provider);
  if (!parsed.success) {
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(t("profileAction.disconnectInvalid"))}`);
  }

  await prisma.externalAccount.deleteMany({
    where: {
      userId,
      provider: parsed.data,
    },
  });

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(
    `/profile?tab=integrations&disconnected=${getProviderQueryValue(parsed.data)}`,
  );
}

export async function connectPlayStationAction(formData: FormData) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent(t("profileAction.needPlayStationLogin"))}`);
  }

  const parsed = playStationConnectSchema.safeParse({
    npsso: formData.get("npsso"),
  });

  if (!parsed.success) {
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(t("profileAction.invalidPlayStationToken"))}`);
  }

  try {
    await connectPlayStationAccountForUser({
      userId,
      npsso: parsed.data.npsso,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : t("profileAction.playStationConnectFailed");
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect("/profile?tab=integrations&playstation=connected");
}

export async function syncPlayStationLibraryAction() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent(t("profileAction.needPlayStationSyncLogin"))}`);
  }

  const limitError = await checkActionAbuse([{ name: "manual-playstation-sync", limit: 1, windowSeconds: 60 }], userId);
  if (limitError) redirect(`/profile?tab=integrations&error=${encodeURIComponent(limitError)}`);

  let result: Awaited<ReturnType<typeof playStationSyncQueue.enqueue>>;
  try {
    result = await playStationSyncQueue.enqueue(userId);
  } catch {
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(t("profileAction.playStationSyncFailed"))}`);
  }
  if (result.kind !== "queued") {
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(t("profileAction.playStationSyncFailed"))}`);
  }
  const runId = result.runId;
  after(async () => {
    try {
      if (await playStationSyncQueue.drain(runId)) {
        revalidatePath("/profile");
        revalidatePath("/");
      }
    } catch {
      console.warn("PlayStation worker deferred to the next scheduled tick.");
    }
  });
  revalidatePath("/profile");
  redirect("/profile?tab=integrations");
}

export async function syncXboxLibraryAction() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent(t("profileAction.needXboxSyncLogin"))}`);
  }

  const limitError = await checkActionAbuse([{ name: "manual-xbox-sync", limit: 1, windowSeconds: 60 }], userId);
  if (limitError) redirect(`/profile?tab=integrations&error=${encodeURIComponent(limitError)}`);

  let result: Awaited<ReturnType<typeof runManualPlatformSync>>;
  try {
    result = await runManualPlatformSync({
      userId,
      provider: ExternalProvider.XBOX,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t("profileAction.xboxSyncFailed");
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(message)}`);
  }
  if (result.kind !== "succeeded") {
    if (result.kind === "skipped" && result.reason === "locked") {
      redirect(`/profile?tab=integrations&syncPending=1`);
    }
    redirect(
      `/profile?tab=integrations&error=${encodeURIComponent(t("profileAction.xboxSyncFailed"))}`,
    );
  }
  const syncedCount = result.syncedCount;

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?tab=integrations&xboxSynced=${syncedCount}`);
}

export async function connectGogAction(formData: FormData) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(
      `/login?error=${encodeURIComponent(t("profileAction.needGogLogin"))}`,
    );
  }

  const parsed = gogConnectSchema.safeParse({
    redirectUrl: formData.get("redirectUrl"),
  });
  if (!parsed.success) {
    redirect(
      `/profile?tab=integrations&error=${encodeURIComponent(t("profileAction.invalidGogRedirectUrl"))}`,
    );
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GOG_OAUTH_STATE_COOKIE)?.value ?? "";
  cookieStore.delete(GOG_OAUTH_STATE_COOKIE);

  try {
    const code = parseGogRedirectUrl(parsed.data.redirectUrl, expectedState);
    await connectGogAccountForUser({ code, userId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t("profileAction.gogConnectFailed");
    redirect(
      `/profile?tab=integrations&error=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect("/profile?tab=integrations&gog=connected");
}

export async function syncGogLibraryAction() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(
      `/login?error=${encodeURIComponent(t("profileAction.needGogSyncLogin"))}`,
    );
  }

  let result: Awaited<ReturnType<typeof runManualPlatformSync>>;
  try {
    result = await runManualPlatformSync({
      userId,
      provider: ExternalProvider.GOG,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t("profileAction.gogSyncFailed");
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(message)}`);
  }
  if (result.kind !== "succeeded") {
    if (result.kind === "skipped" && result.reason === "locked") {
      redirect("/profile?tab=integrations&syncPending=1");
    }
    redirect(
      `/profile?tab=integrations&error=${encodeURIComponent(t("profileAction.gogSyncFailed"))}`,
    );
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?tab=integrations&gogSynced=${result.syncedCount}`);
}

export async function syncUserReviewsAction() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent(t("profileAction.needReviewsLogin"))}`);
  }

  let importedCount: number;
  try {
    const result = await syncUserReviews(userId);
    importedCount = result.importedCount;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t("profileAction.reviewsSyncFailed");
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?tab=integrations&reviewsSynced=${importedCount}`);
}

export async function importCsvAction(formData: FormData) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent(t("profileAction.needCsvLogin"))}`);
  }

  const limitError = await checkActionAbuse([ABUSE_LIMITS.csvImport], userId);
  if (limitError) redirect(`/profile?tab=integrations&error=${encodeURIComponent(limitError)}`);

  const csvText = formData.get("csvText");
  if (typeof csvText === "string" && !csvFits(csvText)) {
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(t("csv.tooLarge"))}`);
  }
  const parsed = importSchema.safeParse({
    fileName: formData.get("fileName"),
    csvText: formData.get("csvText"),
    mapping: formData.get("mapping"),
  });

  if (!parsed.success) {
    redirect(`/profile?error=${encodeURIComponent(t("profileAction.invalidCsv"))}`);
  }

  const mapping = parseCsvColumnMappingJson(parsed.data.mapping);
  if (!mapping) {
    redirect(`/profile?error=${encodeURIComponent(t("profileAction.invalidCsv"))}`);
  }

  let importedCount: number;
  try {
    const result = await importCsvForUser({
      userId,
      fileName: parsed.data.fileName,
      csvText: parsed.data.csvText,
      mapping,
    });
    importedCount = result.importedCount;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t("profileAction.csvImportFailed");
    redirect(`/profile?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?imported=${importedCount}`);
}

export async function importPhotoCatalogAction(formData: FormData) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: t("profileAction.needPhotoLogin") };
  }

  let importedCount: number;
  try {
    const encoded = formData.get("uploads");
    if (typeof encoded !== "string" || new TextEncoder().encode(encoded).length > CATALOG_UPLOAD_REQUEST_MAX_BYTES) {
      return { error: t("profileAction.photoUploadAtLeastOne") };
    }
    const uploads = catalogUploadsSchema.parse(JSON.parse(encoded));
    const result = await importPhotoCatalogForUser({
      userId,
      uploads,
      messages: {
        uploadAtLeastOne: t("profileAction.photoUploadAtLeastOne"),
        onlyImages: t("profileAction.photoOnlyImages"),
        noVisibleGames: t("profileAction.photoNoVisibleGames"),
        visionUnavailable: t("profileAction.photoVisionUnavailable"),
        needsAiKey: t("profileAction.photoNeedsAiKey"),
        fileTooLarge: t("profileAction.photoFileTooLarge"),
        aiDisabled: t("profileAction.photoAiDisabled"),
        lowConfidence: t("profileAction.photoLowConfidence"),
        rowFailed: t("profileAction.photoRowFailed"),
        importFailed: t("profileAction.photoImportFailed"),
      },
    });
    importedCount = result.importedCount;
  } catch (error) {
    console.warn("Photo catalog import failed.", { kind: error instanceof Error ? error.name : "unknown" });
    return { error: t("profileAction.photoImportFailed") };
  }

  revalidatePath("/profile");
  revalidatePath("/");
  return { success: true, importedCount };
}

export async function createJournalEntryAction(formData: FormData) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent(t("profileAction.needJournalLogin"))}`);
  }

  const parsed = journalEntrySchema.safeParse({
    userGameEntryId: formData.get("userGameEntryId"),
    title: formData.get("title") || undefined,
    body: formData.get("body") || undefined,
    occurredAt: formData.get("occurredAt") || undefined,
    slug: formData.get("slug") || undefined,
    returnTo: formData.get("returnTo") || undefined,
  });

  if (!parsed.success) {
    redirect(`/profile?tab=journal&error=${encodeURIComponent(t("profileAction.journalSaveFailed"))}`);
  }

  let imageUpload;
  let audioUpload;
  try {
    imageUpload = parseJournalUpload(formData.get("imageUpload"));
    audioUpload = parseJournalUpload(formData.get("audioUpload"));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t("profileAction.journalSaveFailed");
    redirect(`/profile?tab=journal&error=${encodeURIComponent(message)}`);
  }
  if (
    !parsed.data.title?.trim() &&
    !parsed.data.body?.trim() &&
    !imageUpload &&
    !audioUpload
  ) {
    redirect(
      `/profile?tab=journal&entryId=${encodeURIComponent(parsed.data.userGameEntryId)}&error=${encodeURIComponent(t("profileAction.journalEmptyPage"))}`,
    );
  }

  let occurredAt: Date | null = null;
  if (parsed.data.occurredAt) {
    const parsedDate = new Date(parsed.data.occurredAt);
    occurredAt = Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  try {
    await createJournalEntryForUser({
      userId,
      userGameEntryId: parsed.data.userGameEntryId,
      title: parsed.data.title ?? null,
      body: parsed.data.body ?? null,
      occurredAt,
      targetLanguage: locale === "pt-BR" ? "Portuguese (Brazil)" : "English",
      imageUpload,
      audioUpload,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t("profileAction.journalSaveFailed");
    redirect(`/profile?tab=journal&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");

  const returnPath = getSafeReturnPath(parsed.data.returnTo);
  if (returnPath) {
    if (parsed.data.slug) {
      revalidatePath(`/games/${parsed.data.slug}`);
    }
    redirect(returnPath);
  }

  if (parsed.data.slug) {
    revalidatePath(`/games/${parsed.data.slug}`);
    redirect(`/games/${parsed.data.slug}`);
  }

  redirect("/profile?tab=journal");
}

export async function deleteJournalEntryAction(formData: FormData) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent(t("profileAction.needJournalLogin"))}`);
  }

  const parsed = deleteJournalEntrySchema.safeParse({
    journalEntryId: formData.get("journalEntryId"),
    slug: formData.get("slug") || undefined,
    returnTo: formData.get("returnTo") || undefined,
  });

  if (!parsed.success) {
    redirect(`/profile?tab=journal&error=${encodeURIComponent(t("profileAction.journalDeleteFailed"))}`);
  }

  try {
    await deleteJournalEntryForUser({
      userId,
      journalEntryId: parsed.data.journalEntryId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t("profileAction.journalDeleteFailed");
    redirect(`/profile?tab=journal&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");

  if (parsed.data.slug) {
    revalidatePath(`/games/${parsed.data.slug}`);
  }

  const returnPath = getSafeReturnPath(parsed.data.returnTo);
  if (returnPath) {
    redirect(returnPath);
  }

  redirect("/profile?tab=journal&journal=deleted");
}

export async function addManualGameAction(formData: FormData) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent(t("profileAction.needManualAddLogin"))}`);
  }

  const parsed = manualGameAddSchema.safeParse({
    igdbId: formData.get("igdbId"),
    title: formData.get("title"),
    platformName: formData.get("platformName"),
    status: formData.get("status"),
    query: formData.get("query"),
  });

  if (!parsed.success) {
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(t("profileAction.manualAddChooseGame"))}`);
  }

  const metadata = await getIgdbGameById(parsed.data.igdbId);
  if (!metadata) {
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(t("profileAction.manualAddLoadFailed"))}`);
  }

  const game = await resolveCatalogGame({
    title: metadata.name,
    platformName: parsed.data.platformName,
    provider: ExternalProvider.IGDB,
    providerGameId: String(metadata.igdbId),
    metadata,
    rawData: {
      source: "manual-igdb-search",
      igdbId: metadata.igdbId,
      title: metadata.name,
    },
  });
  await upsertLibraryCopy({
    userId, gameId: game.id, platformName: parsed.data.platformName, provider: ExternalProvider.IGDB,
    status: parsed.data.status, explicitStatus: true,
    // Re-adding a title changes its status without replacing its sync/account metadata.
    update: {},
    create: {
      source: EntrySource.MANUAL, provider: ExternalProvider.IGDB,
      platformName: parsed.data.platformName,
      rawData: { source: "manual-igdb-search", igdbId: metadata.igdbId, title: metadata.name },
    },
  });
  await recomputeRuleInsightsForUser(userId);

  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath(`/games/${game.slug}`);

  redirect(`/profile?tab=integrations&manualAdded=${game.slug}`);
}

export async function saveOnboardingAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login?error=Sign%20in%20before%20saving%20profile%20preferences.");
  }

  const parsed = onboardingSchema.safeParse({
    playFrequency: String(formData.get("playFrequency") ?? "").trim(),
    playTimes: formData.getAll("playTimes").map(String),
    platforms: formData.getAll("platforms").map(String),
    otherPlatform: String(formData.get("otherPlatform") ?? "").trim(),
  });

  if (!parsed.success) {
    redirect("/profile?error=Those%20setup%20answers%20could%20not%20be%20saved.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingAnswers: {
        ...parsed.data,
        updatedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
      onboardingCompletedAt: new Date(),
      onboardingSkippedAt: null,
    },
  });

  revalidatePath("/profile");
  redirect("/profile?onboarding=updated");
}

export async function saveOnboardingStepAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login?error=Sign%20in%20before%20saving%20profile%20preferences.");
  }

  const returnTo = String(formData.get("returnTo") ?? "");
  if (returnTo === "calendar" && !hasProAccess(await getPlanAccount(userId))) redirect("/account/billing");
  const parsed = parseOnboardingStepData(formData);
  if (!parsed.ok) {
    redirect(returnTo === "calendar" ? "/profile?tab=calendar&error=Preferences%20could%20not%20be%20saved." : "/profile?tab=setup&error=Those%20setup%20answers%20could%20not%20be%20saved.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingAnswers: true },
  });
  const existing = getExistingOnboardingAnswers(user?.onboardingAnswers ?? null);
  const merged = {
    ...existing,
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  };
  const isFinalStep = parsed.step === "platforms";

  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingAnswers: merged as Prisma.InputJsonValue,
      onboardingCompletedAt: isFinalStep ? new Date() : undefined,
      onboardingSkippedAt: isFinalStep ? null : undefined,
    },
  });

  revalidatePath("/profile");

  if (returnTo === "calendar") {
    redirect("/profile?tab=calendar&onboarding=updated");
  }

  const nextStep = getNextSetupStep(parsed.step);
  if (nextStep) {
    redirect(`/profile?tab=setup&step=${nextStep}`);
  }

  redirect("/profile?tab=setup&onboarding=updated");
}

export async function skipOnboardingAction() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login?error=Sign%20in%20before%20changing%20onboarding.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingSkippedAt: new Date(),
    },
  });

  revalidatePath("/profile");
  redirect("/profile?onboarding=skipped");
}

export async function clearOnboardingAction() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login?error=Sign%20in%20before%20changing%20onboarding.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingAnswers: Prisma.JsonNull,
      onboardingCompletedAt: null,
      onboardingSkippedAt: null,
    },
  });

  revalidatePath("/profile");
  redirect("/profile?tab=setup&onboarding=cleared");
}

export async function saveCurrentPlayingAction(formData: FormData) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent(t("profileAction.needCurrentPlayingLogin"))}`);
  }

  const selections = parseCurrentPlayingSelections(formData);
  if (!selections) {
    redirect(`/profile?error=${encodeURIComponent(t("profileAction.invalidCurrentPlaying"))}`);
  }

  try {
    await saveCurrentPlayingSelectionsForUser({ selections, userId });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : t("profileAction.invalidCurrentPlaying");
    redirect(`/profile?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect("/profile?currentPlaying=updated");
}

export async function saveCurrentPlayingSelectionAction(
  formData: FormData,
): Promise<CurrentPlayingSaveResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      ok: false,
      message: "Sign in before changing Current playing.",
    };
  }

  const selections = parseCurrentPlayingSelections(formData);
  if (!selections) {
    return {
      ok: false,
      message: "Choose a valid set of games for Current playing.",
    };
  }

  try {
    await saveCurrentPlayingSelectionsForUser({ selections, userId });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Current playing could not be saved.",
    };
  }

  revalidatePath("/profile");
  revalidatePath("/");

  return { ok: true };
}

export async function clearCurrentPlayingAction() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent(t("profileAction.needCurrentPlayingLogin"))}`);
  }

  await clearCurrentPlayingForUser(userId);

  revalidatePath("/profile");
  revalidatePath("/");
  redirect("/profile?currentPlaying=cleared");
}

export async function clearCurrentPlayingSelectionAction(): Promise<CurrentPlayingSaveResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      ok: false,
      message: "Sign in before changing Current playing.",
    };
  }

  await clearCurrentPlayingForUser(userId);

  revalidatePath("/profile");
  revalidatePath("/");

  return { ok: true };
}

export async function savePlayingNextAction(formData: FormData) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent(t("profileAction.needPlayingNextLogin"))}`);
  }

  const selections = parsePlayingNextSelections(formData);
  if (!selections) {
    redirect(`/profile?error=${encodeURIComponent(t("profileAction.invalidPlayingNext"))}`);
  }

  try {
    await savePlayingNextSelectionsForUser({ selections, userId });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : t("profileAction.invalidPlayingNext");
    redirect(`/profile?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect("/profile?playingNext=updated");
}

export async function savePlayingNextSelectionAction(
  formData: FormData,
): Promise<CurrentPlayingSaveResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      ok: false,
      message: "Sign in before changing Playing next.",
    };
  }

  const selections = parsePlayingNextSelections(formData);
  if (!selections) {
    return {
      ok: false,
      message: "Choose up to three games for Playing next.",
    };
  }

  try {
    await savePlayingNextSelectionsForUser({ selections, userId });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Playing next could not be saved.",
    };
  }

  revalidatePath("/profile");
  revalidatePath("/");

  return { ok: true };
}

export async function addPlayingNextGameAction(
  formData: FormData,
): Promise<CurrentPlayingSaveResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      ok: false,
      message: "Sign in before changing Playing next.",
    };
  }

  const parsed = playingNextGameSchema.safeParse({
    gameId: formData.get("gameId"),
    igdbId: formData.get("igdbId"),
    platformName: formData.get("platformName"),
    replaceEntryId: formData.get("replaceEntryId"),
    slot: formData.get("slot"),
    title: formData.get("title"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Choose a game for Playing next.",
    };
  }

  try {
    await addPlayingNextGameForUser({
      gameId: parsed.data.gameId,
      igdbId: parsed.data.igdbId,
      platformName: parsed.data.platformName,
      replaceEntryId: parsed.data.replaceEntryId,
      slot: parsed.data.slot as 1 | 2 | 3,
      userId,
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Playing next could not be saved.",
    };
  }

  revalidatePath("/profile");
  revalidatePath("/");

  return { ok: true };
}

export async function clearPlayingNextAction() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent(t("profileAction.needPlayingNextLogin"))}`);
  }

  await clearPlayingNextForUser(userId);

  revalidatePath("/profile");
  revalidatePath("/");
  redirect("/profile?playingNext=cleared");
}

export async function clearPlayingNextSelectionAction(): Promise<CurrentPlayingSaveResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      ok: false,
      message: "Sign in before changing Playing next.",
    };
  }

  await clearPlayingNextForUser(userId);

  revalidatePath("/profile");
  revalidatePath("/");

  return { ok: true };
}

export async function detectFinishedGamesAction() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/profile?error=${encodeURIComponent(t("profileAction.needFinishedLogin"))}`);
  }

  let finishedCount: number;
  let scannedCount: number;
  try {
    const result = await detectFinishedGamesForUser(userId);
    finishedCount = result.finishedCount;
    scannedCount = result.scannedCount;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : t("profileAction.finishedCheckFailed");
    redirect(`/profile?error=${encodeURIComponent(message)}`);
  }

  if (finishedCount > 0) {
    await recomputeRuleInsightsForUser(userId);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?finishedDetected=${finishedCount}&finishedScanned=${scannedCount}`);
}

export async function markFinishedAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    return;
  }

  const entryId = formData.get("entryId");
  if (typeof entryId !== "string" || !entryId) {
    return;
  }

  await prisma.$transaction(async tx => {
    await lockLibraryGame(tx, userId, "status");
    const entry = await tx.userGameEntry.findFirst({ where: { id: entryId, userId } });
    if (!entry) return;
    await setLibraryGameStatus(tx, userId, entry.gameId,
      entry.finishedAt || entry.status === UserGameStatus.COMPLETED ? UserGameStatus.OWNED : UserGameStatus.COMPLETED);
  });

  await recomputeRuleInsightsForUser(userId);

  revalidatePath("/profile");
  revalidatePath("/");

  const slug = formData.get("slug");
  if (typeof slug === "string" && slug) {
    revalidatePath(`/games/${slug}`);
  }
}

async function markEntryDroppedForUser({
  entryId,
  userId,
}: {
  entryId: string;
  userId: string;
}) {
  return prisma.$transaction(async tx => {
    await lockLibraryGame(tx, userId, "status");
    const entry = await tx.userGameEntry.findFirst({ where: { id: entryId, userId } });
    if (!entry) return null;
    const restoring = entry.status === UserGameStatus.DROPPED;
    await setLibraryGameStatus(tx, userId, entry.gameId, restoring ? UserGameStatus.OWNED : UserGameStatus.DROPPED);
    return { gameId: entry.gameId, restoring };
  });
}

export async function currentPlayingDropAction(
  formData: FormData,
): Promise<CurrentPlayingGameActionResult> {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      ok: false,
      message: t("profileAction.needCurrentPlayingLogin"),
    };
  }

  const entryId = formData.get("entryId");
  if (typeof entryId !== "string" || !entryId) {
    return {
      ok: false,
      message: t("profileAction.invalidCurrentPlaying"),
    };
  }

  const entry = await prisma.userGameEntry.findFirst({
    where: {
      id: entryId,
      userId,
      currentPlayingSlot: {
        not: null,
      },
    },
    select: {
      game: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!entry) {
    return {
      ok: false,
      message: t("profileAction.invalidCurrentPlaying"),
    };
  }

  await markEntryDroppedForUser({ entryId, userId });
  await recomputeRuleInsightsForUser(userId);

  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath(`/games/${entry.game.slug}`);

  return {
    ok: true,
    gameName: entry.game.name,
    providerRefreshStatus: "unavailable",
  };
}

export async function currentPlayingFinishAction(
  formData: FormData,
): Promise<CurrentPlayingGameActionResult> {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      ok: false,
      message: t("profileAction.needCurrentPlayingLogin"),
    };
  }

  const entryId = formData.get("entryId");
  if (typeof entryId !== "string" || !entryId) {
    return {
      ok: false,
      message: t("profileAction.invalidCurrentPlaying"),
    };
  }

  const entry = await prisma.userGameEntry.findFirst({
    where: {
      id: entryId,
      userId,
      currentPlayingSlot: {
        not: null,
      },
    },
    select: {
      game: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!entry) {
    return {
      ok: false,
      message: t("profileAction.invalidCurrentPlaying"),
    };
  }

  await setLibraryEntryStatus(userId, entryId, UserGameStatus.COMPLETED);

  const refreshResult = await refreshUserGameEntryProviderProgress({
    entryId,
    userId,
  });

  await recomputeRuleInsightsForUser(userId);

  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath(`/games/${entry.game.slug}`);

  return {
    ok: true,
    gameName: entry.game.name,
    providerRefreshStatus: refreshResult.status,
  };
}

export async function markDroppedAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    return;
  }

  const entryId = formData.get("entryId");
  if (typeof entryId !== "string" || !entryId) {
    return;
  }

  const result = await markEntryDroppedForUser({ entryId, userId });
  if (result) {
    await recomputeRuleInsightsForUser(userId);
  }

  revalidatePath("/profile");
  revalidatePath("/");

  const slug = formData.get("slug");
  if (typeof slug === "string" && slug) {
    revalidatePath(`/games/${slug}`);
  }
}

export async function toggleFavoriteAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    return;
  }

  const entryId = formData.get("entryId");
  if (typeof entryId !== "string" || !entryId) {
    return;
  }

  const entry = await prisma.userGameEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry || entry.userId !== userId) {
    return;
  }

  await prisma.userGameEntry.update({
    where: { id: entryId },
    data: { isFavorite: !entry.isFavorite },
  });

  revalidatePath("/profile");
}

export async function togglePhysicalCopyAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    return;
  }

  const entryId = formData.get("entryId");
  if (typeof entryId !== "string" || !entryId) {
    return;
  }

  const entry = await prisma.userGameEntry.findFirst({
    where: { id: entryId, userId },
    include: { game: { select: { slug: true } } },
  });

  if (!entry) {
    return;
  }

  await prisma.userGameEntry.update({
    where: { id: entry.id },
    data: {
      isPhysicalCopy: !entry.isPhysicalCopy,
      userIntent:
        !entry.isPhysicalCopy && entry.userIntent === "needs_purchase"
          ? null
          : undefined,
    },
  });

  revalidatePath("/profile");
  revalidatePath(`/games/${entry.game.slug}`);
}

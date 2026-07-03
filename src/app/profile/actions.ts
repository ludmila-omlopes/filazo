"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  EntrySource,
  ExternalProvider,
  Prisma,
  UserGameStatus,
} from "@prisma/client";
import { z } from "zod";
import {
  importCsvForUser,
  type CsvColumnMapping,
  resolveCatalogGame,
  syncPlayStationLibraryForUser,
  syncSteamLibraryForUser,
  syncXboxLibraryForUser,
} from "@/lib/catalog";
import { getIgdbGameById } from "@/lib/igdb";
import { createTranslator } from "@/lib/i18n";
import {
  createJournalEntryForUser,
  deleteJournalEntryForUser,
  getFormFile,
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

const importSchema = z.object({
  fileName: z.string().min(1),
  csvText: z.string().min(1),
  mapping: z.string().min(1),
});

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
]);

function getProviderQueryValue(provider: ExternalProvider) {
  return provider.toLowerCase();
}

function parseOptionalEntryId(value: unknown) {
  const entryId = String(value ?? "").trim();
  return entryId || null;
}

const currentPlayingSchema = z.object({
  slot1EntryId: z.preprocess(parseOptionalEntryId, z.string().trim().nullable()),
  slot2EntryId: z.preprocess(parseOptionalEntryId, z.string().trim().nullable()),
  slot3EntryId: z.preprocess(parseOptionalEntryId, z.string().trim().nullable()),
});

const playingNextSchema = z.object({
  next1EntryId: z.preprocess(parseOptionalEntryId, z.string().trim().nullable()),
  next2EntryId: z.preprocess(parseOptionalEntryId, z.string().trim().nullable()),
  next3EntryId: z.preprocess(parseOptionalEntryId, z.string().trim().nullable()),
});

const playingNextGameSchema = z.object({
  igdbId: z.coerce.number().int().positive(),
  platformName: z.preprocess(
    (value) => {
      const rawValue = String(value ?? "").trim();
      return rawValue || null;
    },
    z.string().trim().min(1).max(120).nullable(),
  ),
  slot: z.coerce.number().int().min(1).max(3),
  title: z.string().trim().min(1).max(200),
});

const journalEntrySchema = z.object({
  userGameEntryId: z.string().trim().min(1),
  title: z.string().trim().max(160).optional(),
  body: z.string().trim().max(4000).optional(),
  mediaCaption: z.string().trim().max(240).optional(),
  occurredAt: z.string().trim().optional(),
  slug: z.string().trim().optional(),
  returnTo: z.string().trim().optional(),
});

const deleteJournalEntrySchema = z.object({
  journalEntryId: z.string().trim().min(1),
  slug: z.string().trim().optional(),
  returnTo: z.string().trim().optional(),
});

type CurrentPlayingSelection = {
  slot: 1 | 2 | 3;
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
  const parsed = currentPlayingSchema.safeParse({
    slot1EntryId: formData.get("slot1EntryId"),
    slot2EntryId: formData.get("slot2EntryId"),
    slot3EntryId: formData.get("slot3EntryId"),
  });

  if (!parsed.success) {
    return null;
  }

  return [
    { slot: 1, entryId: parsed.data.slot1EntryId },
    { slot: 2, entryId: parsed.data.slot2EntryId },
    { slot: 3, entryId: parsed.data.slot3EntryId },
  ];
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

  const ownedEntry = await tx.userGameEntry.findUnique({
    where: {
      userId_gameId_status: {
        userId,
        gameId: entry.gameId,
        status: UserGameStatus.OWNED,
      },
    },
    select: { id: true },
  });

  if (ownedEntry && ownedEntry.id !== entry.id) {
    await tx.userGameEntry.delete({ where: { id: entry.id } });
    return;
  }

  await tx.userGameEntry.update({
    where: { id: entry.id },
    data: { status: UserGameStatus.OWNED },
  });
}

async function demotePlayingNextEntryToOwned({
  entry,
  tx,
  userId,
}: {
  entry: {
    id: string;
    gameId: string;
    status: UserGameStatus;
    userIntent?: string | null;
  };
  tx: Prisma.TransactionClient;
  userId: string;
}) {
  if (entry.status !== UserGameStatus.PLAYING_NEXT) {
    return;
  }

  if (entry.userIntent === "needs_purchase") {
    await tx.userGameEntry.delete({ where: { id: entry.id } });
    return;
  }

  const ownedEntry = await tx.userGameEntry.findUnique({
    where: {
      userId_gameId_status: {
        userId,
        gameId: entry.gameId,
        status: UserGameStatus.OWNED,
      },
    },
    select: { id: true },
  });

  if (ownedEntry && ownedEntry.id !== entry.id) {
    await tx.userGameEntry.delete({ where: { id: entry.id } });
    return;
  }

  await tx.userGameEntry.update({
    where: { id: entry.id },
    data: { status: UserGameStatus.OWNED },
  });
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
    throw new Error("Choose three different games for Current playing.");
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
      select: { id: true },
    });

    if (entries.length !== selectedEntryIds.length) {
      throw new Error("Only games already on your shelf can be featured.");
    }
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
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

      if (entry.status !== UserGameStatus.PLAYING) {
        const existingPlayingEntry = await tx.userGameEntry.findUnique({
          where: {
            userId_gameId_status: {
              userId,
              gameId: entry.gameId,
              status: UserGameStatus.PLAYING,
            },
          },
          select: { id: true },
        });

        if (
          existingPlayingEntry &&
          existingPlayingEntry.id !== selection.entryId
        ) {
          await tx.userGameEntry.delete({
            where: { id: existingPlayingEntry.id },
          });
        }
      }

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
      select: { id: true },
    });

    if (entries.length !== selectedEntryIds.length) {
      throw new Error("Only unfinished shelf games outside Current playing can be queued.");
    }
  }

  await prisma.$transaction(async (tx) => {
    const previousQueuedEntries = await tx.userGameEntry.findMany({
      where: {
        userId,
        playingNextSlot: {
          not: null,
        },
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

      if (entry.status !== UserGameStatus.PLAYING_NEXT) {
        const existingPlayingNextEntry = await tx.userGameEntry.findUnique({
          where: {
            userId_gameId_status: {
              userId,
              gameId: entry.gameId,
              status: UserGameStatus.PLAYING_NEXT,
            },
          },
          select: { id: true },
        });

        if (
          existingPlayingNextEntry &&
          existingPlayingNextEntry.id !== selection.entryId
        ) {
          await tx.userGameEntry.delete({
            where: { id: existingPlayingNextEntry.id },
          });
        }
      }

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
    const playingNextEntries = await tx.userGameEntry.findMany({
      where: {
        userId,
        playingNextSlot: {
          not: null,
        },
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
        playingNextSlot: {
          not: null,
        },
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
  igdbId,
  platformName,
  slot,
  title,
  userId,
}: {
  igdbId: number;
  platformName: string | null;
  slot: 1 | 2 | 3;
  title: string;
  userId: string;
}) {
  const metadata = await getIgdbGameById(igdbId);
  if (!metadata) {
    throw new Error("Could not load this game from search.");
  }

  const game = await resolveCatalogGame({
    title: metadata.name,
    platformName,
    provider: ExternalProvider.IGDB,
    providerGameId: String(metadata.igdbId),
    metadata,
    rawData: {
      source: "playing-next-igdb-search",
      igdbId: metadata.igdbId,
      title,
    },
  });

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
      status: true,
      userIntent: true,
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
      entry.userIntent !== "needs_purchase" &&
      (ownedPlayingNextStatuses.has(entry.status) ||
        entry.status === UserGameStatus.PLAYING_NEXT),
  );
  const ownedEntry = existingEntries.find(
    (entry) =>
      entry.userIntent !== "needs_purchase" &&
      ownedPlayingNextStatuses.has(entry.status),
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
    const previousSlotEntries = await tx.userGameEntry.findMany({
      where: {
        userId,
        playingNextSlot: slot,
      },
      select: {
        gameId: true,
        id: true,
        status: true,
        userIntent: true,
      },
    });

    for (const entry of previousSlotEntries) {
      if (targetEntry && entry.id === targetEntry.id) {
        continue;
      }

      await tx.userGameEntry.update({
        where: { id: entry.id },
        data: { playingNextSlot: null },
      });
      await demotePlayingNextEntryToOwned({ entry, tx, userId });
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

    if (targetEntry) {
      await tx.userGameEntry.update({
        where: { id: targetEntry.id },
        data: playingNextData,
      });
      return;
    }

    await tx.userGameEntry.create({
      data: {
        userId,
        gameId: game.id,
        source: EntrySource.MANUAL,
        provider: ExternalProvider.IGDB,
        rawData: {
          source: "playing-next-igdb-search",
          igdbId: metadata.igdbId,
          title: metadata.name,
        } as Prisma.InputJsonValue,
        ...playingNextData,
      },
    });
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

  let syncedCount: number;
  try {
    const result = await syncSteamLibraryForUser(userId);
    syncedCount = result.syncedCount;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t("profileAction.steamSyncFailed");
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?tab=integrations&synced=${syncedCount}`);
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

  let syncedCount: number;
  try {
    const result = await syncPlayStationLibraryForUser(userId);
    syncedCount = result.syncedCount;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : t("profileAction.playStationSyncFailed");
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?tab=integrations&playstationSynced=${syncedCount}`);
}

export async function syncXboxLibraryAction() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent(t("profileAction.needXboxSyncLogin"))}`);
  }

  let syncedCount: number;
  try {
    const result = await syncXboxLibraryForUser(userId);
    syncedCount = result.syncedCount;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t("profileAction.xboxSyncFailed");
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?tab=integrations&xboxSynced=${syncedCount}`);
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

  const parsed = importSchema.safeParse({
    fileName: formData.get("fileName"),
    csvText: formData.get("csvText"),
    mapping: formData.get("mapping"),
  });

  if (!parsed.success) {
    redirect(`/profile?error=${encodeURIComponent(t("profileAction.invalidCsv"))}`);
  }

  const mapping = JSON.parse(parsed.data.mapping) as CsvColumnMapping;
  if (!mapping.title) {
    redirect(`/profile?error=${encodeURIComponent(t("profileAction.needTitleMapping"))}`);
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
    redirect(`/login?error=${encodeURIComponent(t("profileAction.needPhotoLogin"))}`);
  }

  const files = formData
    .getAll("images")
    .map((value) => getFormFile(value))
    .filter((file): file is File => Boolean(file));

  let importedCount: number;
  try {
    const result = await importPhotoCatalogForUser({
      userId,
      files,
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
    const message =
      error instanceof Error ? error.message : t("profileAction.photoImportFailed");
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?tab=integrations&photoImported=${importedCount}`);
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
    mediaCaption: formData.get("mediaCaption") || undefined,
    occurredAt: formData.get("occurredAt") || undefined,
    slug: formData.get("slug") || undefined,
    returnTo: formData.get("returnTo") || undefined,
  });

  if (!parsed.success) {
    redirect(`/profile?tab=journal&error=${encodeURIComponent(t("profileAction.journalSaveFailed"))}`);
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
      mediaCaption: parsed.data.mediaCaption ?? null,
      occurredAt,
      targetLanguage: locale === "pt-BR" ? "Portuguese (Brazil)" : "English",
      imageFile: getFormFile(formData.get("image")),
      audioFile: getFormFile(formData.get("audio")),
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
  const finishedData =
    parsed.data.status === UserGameStatus.COMPLETED
      ? {
          finishedAt: new Date(),
          finishedSource: "manual",
        }
      : {};
  const droppedData =
    parsed.data.status === UserGameStatus.DROPPED
      ? {
          abandonedAt: new Date(),
          activeBacklog: false,
        }
      : {};

  await prisma.userGameEntry.upsert({
    where: {
      userId_gameId_status: {
        userId,
        gameId: game.id,
        status: parsed.data.status,
      },
    },
    update: {
      source: EntrySource.MANUAL,
      provider: ExternalProvider.IGDB,
      platformName: parsed.data.platformName ?? undefined,
      ...finishedData,
      ...droppedData,
      rawData: {
        source: "manual-igdb-search",
        igdbId: metadata.igdbId,
        title: metadata.name,
      } as Prisma.InputJsonValue,
    },
    create: {
      userId,
      gameId: game.id,
      status: parsed.data.status,
      source: EntrySource.MANUAL,
      provider: ExternalProvider.IGDB,
      platformName: parsed.data.platformName ?? undefined,
      ...finishedData,
      ...droppedData,
      rawData: {
        source: "manual-igdb-search",
        igdbId: metadata.igdbId,
        title: metadata.name,
      } as Prisma.InputJsonValue,
    },
  });

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

  const parsed = parseOnboardingStepData(formData);
  if (!parsed.ok) {
    redirect("/profile?tab=setup&error=Those%20setup%20answers%20could%20not%20be%20saved.");
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
      message: "Choose up to three games for Current playing.",
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
    igdbId: formData.get("igdbId"),
    platformName: formData.get("platformName"),
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
      igdbId: parsed.data.igdbId,
      platformName: parsed.data.platformName,
      slot: parsed.data.slot as 1 | 2 | 3,
      title: parsed.data.title,
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

  const entry = await prisma.userGameEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry || entry.userId !== userId) {
    return;
  }

  await prisma.userGameEntry.update({
    where: { id: entryId },
    data: entry.finishedAt
      ? { finishedAt: null, finishedSource: null }
      : {
          finishedAt: new Date(),
          finishedSource: "manual",
          playingNextSlot: null,
        },
  });

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
  const entry = await prisma.userGameEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry || entry.userId !== userId) {
    return null;
  }

  const restoring = entry.status === UserGameStatus.DROPPED;
  const targetStatus = restoring
    ? UserGameStatus.OWNED
    : UserGameStatus.DROPPED;
  const existingTarget = await prisma.userGameEntry.findUnique({
    where: {
      userId_gameId_status: {
        userId,
        gameId: entry.gameId,
        status: targetStatus,
      },
    },
  });
  const statusData = restoring
    ? {
        abandonedAt: null,
        abandonReason: null,
        activeBacklog: true,
      }
    : {
        abandonedAt: entry.abandonedAt ?? new Date(),
        abandonReason: entry.abandonReason ?? "manual",
        activeBacklog: false,
        currentPlayingSlot: null,
        finishedAt: null,
        finishedSource: null,
        playingNextSlot: null,
      };

  if (existingTarget && existingTarget.id !== entry.id) {
    const mergedRawData = existingTarget.rawData ?? entry.rawData;

    await prisma.$transaction([
      prisma.userGameEntry.update({
        where: { id: existingTarget.id },
        data: {
          ...statusData,
          completionPercent:
            existingTarget.completionPercent ?? entry.completionPercent ?? undefined,
          lastPlayedAt:
            existingTarget.lastPlayedAt ?? entry.lastPlayedAt ?? undefined,
          notes: existingTarget.notes ?? entry.notes ?? undefined,
          platformName:
            existingTarget.platformName ?? entry.platformName ?? undefined,
          playtimeMinutes:
            existingTarget.playtimeMinutes ?? entry.playtimeMinutes ?? undefined,
          rawData:
            mergedRawData === null
              ? undefined
              : (mergedRawData as Prisma.InputJsonValue),
        },
      }),
      prisma.userGameEntry.delete({ where: { id: entry.id } }),
    ]);
  } else {
    await prisma.userGameEntry.update({
      where: { id: entry.id },
      data: {
        status: targetStatus,
        ...statusData,
      },
    });
  }

  return {
    gameId: entry.gameId,
    restoring,
  };
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

  await prisma.userGameEntry.update({
    where: { id: entryId },
    data: {
      currentPlayingSlot: null,
      finishedAt: new Date(),
      finishedSource: "manual",
      playingNextSlot: null,
    },
  });

  const refreshResult = await refreshUserGameEntryProviderProgress({
    entryId,
    userId,
  });

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

  await markEntryDroppedForUser({ entryId, userId });

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

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
import { connectPlayStationAccountForUser } from "@/lib/playstation";
import { prisma } from "@/lib/prisma";
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

type CurrentPlayingSelection = {
  slot: 1 | 2 | 3;
  entryId: string | null;
};

type CurrentPlayingSaveResult =
  | { ok: true }
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
          startedAt: entry.startedAt ?? now,
          status: UserGameStatus.PLAYING,
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
    z.nativeEnum(UserGameStatus),
  ),
  query: z.preprocess(
    (value) => {
      const rawValue = String(value ?? "").trim();
      return rawValue || null;
    },
    z.string().trim().nullable(),
  ),
});

export async function syncSteamLibraryAction() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login?error=Sign%20in%20before%20syncing%20Steam.");
  }

  let syncedCount: number;
  try {
    const result = await syncSteamLibraryForUser(userId);
    syncedCount = result.syncedCount;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Steam sync did not complete.";
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?tab=integrations&synced=${syncedCount}`);
}

export async function disconnectProviderAction(provider: ExternalProvider) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login?error=Sign%20in%20before%20changing%20integrations.");
  }

  const parsed = disconnectProviderSchema.safeParse(provider);
  if (!parsed.success) {
    redirect("/profile?tab=integrations&error=That%20integration%20cannot%20be%20disconnected.");
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
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login?error=Sign%20in%20before%20connecting%20PlayStation.");
  }

  const parsed = playStationConnectSchema.safeParse({
    npsso: formData.get("npsso"),
  });

  if (!parsed.success) {
    redirect("/profile?tab=integrations&error=Enter%20a%20valid%20PlayStation%20NPSSO%20token.");
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
        : "Could not connect PlayStation.";
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect("/profile?tab=integrations&playstation=connected");
}

export async function syncPlayStationLibraryAction() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login?error=Sign%20in%20before%20syncing%20PlayStation.");
  }

  let syncedCount: number;
  try {
    const result = await syncPlayStationLibraryForUser(userId);
    syncedCount = result.syncedCount;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "PlayStation sync did not complete.";
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?tab=integrations&playstationSynced=${syncedCount}`);
}

export async function syncXboxLibraryAction() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login?error=Sign%20in%20before%20syncing%20Xbox.");
  }

  let syncedCount: number;
  try {
    const result = await syncXboxLibraryForUser(userId);
    syncedCount = result.syncedCount;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Xbox sync did not complete.";
    redirect(`/profile?tab=integrations&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?tab=integrations&xboxSynced=${syncedCount}`);
}

export async function importCsvAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login?error=Sign%20in%20before%20importing%20CSV%20data.");
  }

  const parsed = importSchema.safeParse({
    fileName: formData.get("fileName"),
    csvText: formData.get("csvText"),
    mapping: formData.get("mapping"),
  });

  if (!parsed.success) {
    redirect("/profile?error=Please%20upload%20a%20valid%20CSV%20file.");
  }

  const mapping = JSON.parse(parsed.data.mapping) as CsvColumnMapping;
  if (!mapping.title) {
    redirect("/profile?error=Map%20a%20title%20column%20before%20importing.");
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
      error instanceof Error ? error.message : "CSV import did not complete.";
    redirect(`/profile?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?imported=${importedCount}`);
}

export async function addManualGameAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login?error=Sign%20in%20before%20adding%20games.");
  }

  const parsed = manualGameAddSchema.safeParse({
    igdbId: formData.get("igdbId"),
    title: formData.get("title"),
    platformName: formData.get("platformName"),
    status: formData.get("status"),
    query: formData.get("query"),
  });

  if (!parsed.success) {
    redirect("/profile?tab=integrations&error=Choose%20a%20game%20result%20before%20adding.");
  }

  const metadata = await getIgdbGameById(parsed.data.igdbId);
  if (!metadata) {
    redirect("/profile?tab=integrations&error=That%20game%20could%20not%20be%20loaded.");
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

export async function saveCurrentPlayingAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login?error=Sign%20in%20before%20changing%20Current%20playing.");
  }

  const selections = parseCurrentPlayingSelections(formData);
  if (!selections) {
    redirect("/profile?error=Choose%20up%20to%20three%20games%20for%20Current%20playing.");
  }

  try {
    await saveCurrentPlayingSelectionsForUser({ selections, userId });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Current playing could not be saved.";
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
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login?error=Sign%20in%20before%20changing%20Current%20playing.");
  }

  await clearCurrentPlayingForUser(userId);

  revalidatePath("/profile");
  revalidatePath("/");
  redirect("/profile?currentPlaying=cleared");
}

export async function detectFinishedGamesAction() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/profile?error=Sign%20in%20before%20detecting%20finished%20games.");
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
        : "Credits-rolled check did not complete.";
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
      : { finishedAt: new Date(), finishedSource: "manual" },
  });

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

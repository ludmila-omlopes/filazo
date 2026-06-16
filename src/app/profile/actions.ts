"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ExternalProvider,
  UserGameStatus,
} from "@prisma/client";
import { z } from "zod";
import {
  importCsvForUser,
  type CsvColumnMapping,
  syncPlayStationLibraryForUser,
  syncSteamLibraryForUser,
  syncXboxLibraryForUser,
} from "@/lib/catalog";
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

export async function saveCurrentPlayingAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login?error=Sign%20in%20before%20changing%20Current%20playing.");
  }

  const parsed = currentPlayingSchema.safeParse({
    slot1EntryId: formData.get("slot1EntryId"),
    slot2EntryId: formData.get("slot2EntryId"),
    slot3EntryId: formData.get("slot3EntryId"),
  });

  if (!parsed.success) {
    redirect("/profile?error=Choose%20up%20to%20three%20games%20for%20Current%20playing.");
  }

  const selections = [
    { slot: 1, entryId: parsed.data.slot1EntryId },
    { slot: 2, entryId: parsed.data.slot2EntryId },
    { slot: 3, entryId: parsed.data.slot3EntryId },
  ];
  const selectedEntryIds = selections
    .map((selection) => selection.entryId)
    .filter((entryId): entryId is string => Boolean(entryId));

  if (new Set(selectedEntryIds).size !== selectedEntryIds.length) {
    redirect("/profile?error=Choose%20three%20different%20games%20for%20Current%20playing.");
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
      redirect("/profile?error=Only%20games%20already%20on%20your%20shelf%20can%20be%20featured.");
    }
  }

  await prisma.$transaction(async (tx) => {
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

    for (const selection of selections) {
      if (!selection.entryId) {
        continue;
      }

      await tx.userGameEntry.update({
        where: { id: selection.entryId },
        data: { currentPlayingSlot: selection.slot },
      });
    }
  });

  revalidatePath("/profile");
  revalidatePath("/");
  redirect("/profile?currentPlaying=updated");
}

export async function clearCurrentPlayingAction() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login?error=Sign%20in%20before%20changing%20Current%20playing.");
  }

  await prisma.userGameEntry.updateMany({
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

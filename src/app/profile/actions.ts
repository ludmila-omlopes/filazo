"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

const importSchema = z.object({
  fileName: z.string().min(1),
  csvText: z.string().min(1),
  mapping: z.string().min(1),
});

const playStationConnectSchema = z.object({
  npsso: z.string().trim().min(32).max(512),
});

export async function syncSteamLibraryAction() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/profile?error=Sign%20in%20before%20syncing%20Steam.");
  }

  let syncedCount: number;
  try {
    const result = await syncSteamLibraryForUser(userId);
    syncedCount = result.syncedCount;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Steam sync failed.";
    redirect(`/profile?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?synced=${syncedCount}`);
}

export async function connectPlayStationAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/profile?error=Sign%20in%20before%20connecting%20PlayStation.");
  }

  const parsed = playStationConnectSchema.safeParse({
    npsso: formData.get("npsso"),
  });

  if (!parsed.success) {
    redirect("/profile?error=Enter%20a%20valid%20PlayStation%20NPSSO%20token.");
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
    redirect(`/profile?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect("/profile?playstation=connected");
}

export async function syncPlayStationLibraryAction() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/profile?error=Sign%20in%20before%20syncing%20PlayStation.");
  }

  let syncedCount: number;
  try {
    const result = await syncPlayStationLibraryForUser(userId);
    syncedCount = result.syncedCount;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "PlayStation sync failed.";
    redirect(`/profile?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?playstationSynced=${syncedCount}`);
}

export async function syncXboxLibraryAction() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/profile?error=Sign%20in%20before%20syncing%20Xbox.");
  }

  let syncedCount: number;
  try {
    const result = await syncXboxLibraryForUser(userId);
    syncedCount = result.syncedCount;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Xbox sync failed.";
    redirect(`/profile?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?xboxSynced=${syncedCount}`);
}

export async function importCsvAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/profile?error=Sign%20in%20before%20importing%20CSV%20data.");
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
      error instanceof Error ? error.message : "CSV import failed.";
    redirect(`/profile?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/");
  redirect(`/profile?imported=${importedCount}`);
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

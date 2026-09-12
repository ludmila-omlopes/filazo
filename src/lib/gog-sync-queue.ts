import type { PrismaClient } from "@prisma/client";
import { importGogLibraryGame } from "@/lib/catalog";
import { fetchGogLibraryPage } from "@/lib/gog";
import { createLibrarySyncQueue } from "@/lib/library-sync-queue";

export function createGogSyncQueue({
  db,
  importGame = importGogLibraryGame,
  fetchPage = fetchGogLibraryPage,
}: {
  db?: PrismaClient;
  importGame?: typeof importGogLibraryGame;
  fetchPage?: typeof fetchGogLibraryPage;
} = {}) {
  return createLibrarySyncQueue({ provider: "GOG", db, importGame, fetchPage });
}

export const gogSyncQueue = createGogSyncQueue();

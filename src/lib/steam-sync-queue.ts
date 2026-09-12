import { type PrismaClient } from "@prisma/client";
import { importSteamLibraryGame } from "@/lib/catalog";
import { steamAdapter } from "@/lib/steam";
import { createLibrarySyncQueue } from "@/lib/library-sync-queue";

export function createSteamSyncQueue({
  db,
  importGame = importSteamLibraryGame,
  fetchProfile = steamAdapter.fetchProfile,
  fetchLibrary = steamAdapter.syncOwnedLibrary,
}: {
  db?: PrismaClient;
  importGame?: typeof importSteamLibraryGame;
  fetchProfile?: typeof steamAdapter.fetchProfile;
  fetchLibrary?: typeof steamAdapter.syncOwnedLibrary;
} = {}) {
  return createLibrarySyncQueue({
    provider: "STEAM",
    db,
    importGame,
    fetchPage: async (account, _page, signal) => {
      const [profile, games] = await Promise.all([
        fetchProfile(account.providerAccountId, { signal }),
        fetchLibrary(account.providerAccountId, { signal }),
      ]);
      return { profile, games, nextPage: null, totalCount: games.length };
    },
  });
}

export const steamSyncQueue = createSteamSyncQueue();

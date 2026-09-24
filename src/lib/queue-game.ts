import { ExternalProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getIgdbGameById } from "@/lib/igdb";
import { resolveCatalogGame } from "@/lib/catalog";

export async function resolveQueueGame({ gameId, igdbId, platformName }: {
  gameId: string | null;
  igdbId: number | null;
  platformName: string | null;
}) {
  if (gameId || igdbId) {
    const game = await prisma.game.findUnique({
      where: gameId ? { id: gameId } : { igdbId: igdbId! },
      select: { id: true, slug: true, name: true, igdbId: true },
    });
    if (game) return game;
    // A stale catalog selection must not silently create a different game.
    if (gameId) throw new Error("This game is no longer in the catalog. Search again.");
  }
  if (!igdbId) throw new Error("Choose a game for Playing next.");
  const metadata = await getIgdbGameById(igdbId);
  if (!metadata) throw new Error("Could not load this game from search.");
  return resolveCatalogGame({
    title: metadata.name, platformName, provider: ExternalProvider.IGDB,
    providerGameId: String(metadata.igdbId), metadata,
    rawData: { source: "playing-next-igdb-search", igdbId: metadata.igdbId, title: metadata.name },
  });
}

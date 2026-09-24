import { UserGameStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { searchIgdbGames } from "@/lib/igdb";
import { readStringList } from "@/lib/game-metadata";
import { normalizeTitle } from "@/lib/utils";

const LIMIT = 8;
const gameSelect = {
  id: true, igdbId: true, slug: true, name: true, normalizedName: true,
  summary: true, coverUrl: true, releaseDate: true, platforms: true, genres: true,
} satisfies Prisma.GameSelect;

export type QueueGameSearchResult = {
  gameId: string | null;
  igdbId: number | null;
  name: string;
  summary: string | null;
  coverUrl: string | null;
  releaseDate: string | null;
  platforms: string[];
  genres: string[];
  existingSlug: string | null;
  isDropped: boolean;
  isOwned: boolean;
  isQueued: boolean;
};

export async function searchQueueGames(query: string, userId: string) {
  const normalized = normalizeTitle(query);
  const match: Prisma.GameWhereInput = { OR: [
    { name: { contains: query, mode: "insensitive" } },
    ...(normalized ? [{ normalizedName: { contains: normalized } }] : []),
  ] };
  const exact: Prisma.GameWhereInput = { OR: [
    { name: { equals: query, mode: "insensitive" } },
    ...(normalized ? [{ normalizedName: normalized }] : []),
  ] };
  // Exact titles and the user's own library cannot be crowded out by provider results.
  const [exactGames, libraryGames, catalogGames] = await Promise.all([
    prisma.game.findMany({ where: exact, select: gameSelect, take: LIMIT, orderBy: { id: "asc" } }),
    prisma.game.findMany({ where: { AND: [match, { userEntries: { some: { userId } } }] }, select: gameSelect, take: LIMIT, orderBy: { name: "asc" } }),
    prisma.game.findMany({ where: match, select: gameSelect, take: LIMIT, orderBy: { name: "asc" } }),
  ]);
  const localGames = [...new Map([...exactGames, ...libraryGames, ...catalogGames].map(game => [game.id, game])).values()].slice(0, LIMIT);
  const results: QueueGameSearchResult[] = localGames.map(game => ({
    gameId: game.id, igdbId: game.igdbId, name: game.name,
    summary: game.summary, coverUrl: game.coverUrl,
    releaseDate: game.releaseDate?.toISOString() ?? null,
    platforms: readStringList(game.platforms), genres: readStringList(game.genres),
    existingSlug: game.slug, isDropped: false, isOwned: false, isQueued: false,
  }));

  if (results.length < LIMIT) {
    const remote = await searchIgdbGames(query, LIMIT, AbortSignal.timeout(3_000)).catch(() => {
      console.warn("Queue search: external game search unavailable; keeping catalog results.");
      return [];
    });
    const matched = remote.length ? await prisma.game.findMany({
      where: { OR: [
        { igdbId: { in: remote.map(game => game.igdbId) } },
        { normalizedName: { in: remote.map(game => normalizeTitle(game.name)).filter(Boolean) } },
      ] },
      select: gameSelect, take: LIMIT * 2, orderBy: { id: "asc" },
    }) : [];
    for (const game of remote) {
      const existing = matched.find(item => item.igdbId === game.igdbId)
        ?? matched.find(item => item.normalizedName === normalizeTitle(game.name));
      if (results.some(item => item.igdbId === game.igdbId || (existing && item.gameId === existing.id))) continue;
      results.push({
        gameId: existing?.id ?? null, igdbId: existing?.igdbId ?? game.igdbId,
        name: existing?.name ?? game.name, summary: existing?.summary ?? game.summary ?? null,
        coverUrl: existing?.coverUrl ?? game.coverUrl ?? null,
        releaseDate: (existing?.releaseDate ?? game.releaseDate)?.toISOString() ?? null,
        platforms: existing ? readStringList(existing.platforms) : game.platforms ?? [],
        genres: existing ? readStringList(existing.genres) : game.genres ?? [],
        existingSlug: existing?.slug ?? null, isDropped: false, isOwned: false, isQueued: false,
      });
      if (results.length === LIMIT) break;
    }
  }

  const gameIds = results.flatMap(game => game.gameId ? [game.gameId] : []);
  const entries = gameIds.length ? await prisma.userGameEntry.findMany({
    where: { userId, gameId: { in: gameIds } },
    select: { gameId: true, status: true, userIntent: true, isPhysicalCopy: true },
  }) : [];
  return results.map(game => {
    const copies = entries.filter(entry => entry.gameId === game.gameId);
    return { ...game,
      isDropped: copies.some(entry => entry.status === UserGameStatus.DROPPED),
      isQueued: copies.some(entry => entry.status === UserGameStatus.PLAYING_NEXT),
      isOwned: copies.some(entry => entry.isPhysicalCopy || (entry.userIntent !== "needs_purchase" && entry.status !== UserGameStatus.WISHLIST)),
    };
  });
}

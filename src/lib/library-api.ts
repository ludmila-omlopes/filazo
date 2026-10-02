import { toApiStatus, type LibraryApiQuery } from "./api-token-policy";
import { prisma } from "./prisma";
import { getSiteUrl } from "./site-metadata";

/**
 * One page of the key owner's library. Personal notes, intents and provider
 * account details stay out: the consuming site may render this publicly.
 */
export async function getLibraryPageForApi(userId: string, query: LibraryApiQuery) {
  const entries = await prisma.userGameEntry.findMany({
    where: {
      userId,
      ...(query.statuses ? { status: { in: query.statuses } } : {}),
      ...(query.cursor ? { id: { gt: query.cursor } } : {}),
    },
    orderBy: { id: "asc" },
    take: query.limit + 1,
    select: {
      id: true,
      status: true,
      platformName: true,
      playtimeMinutes: true,
      lastPlayedAt: true,
      startedAt: true,
      finishedAt: true,
      completionPercent: true,
      isFavorite: true,
      isPhysicalCopy: true,
      createdAt: true,
      updatedAt: true,
      game: {
        select: {
          id: true,
          slug: true,
          name: true,
          coverUrl: true,
          releaseDate: true,
          genres: true,
          platforms: true,
        },
      },
    },
  });

  const page = entries.slice(0, query.limit);
  const siteUrl = getSiteUrl();
  return {
    data: page.map(({ game, status, createdAt, ...entry }) => ({
      ...entry,
      status: toApiStatus(status),
      addedAt: createdAt,
      game: { ...game, url: new URL(`/games/${game.slug}`, siteUrl).toString() },
    })),
    nextCursor: entries.length > query.limit ? page.at(-1)!.id : null,
  };
}

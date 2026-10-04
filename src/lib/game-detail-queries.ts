import { Prisma, type PrismaClient, type UserGameEntry } from "@prisma/client";
import { parseMarketplaceSnapshot } from "@/lib/assistant/marketplace-search";
import { indexableGameSelect, isIndexableGame, looksLikeGameExtra } from "@/lib/game-indexing";
import { readDiscoverySnapshot } from "@/lib/game-affinity";
import { parseSteamReviewsSnapshot } from "@/lib/steam-reviews";

type DisplayEntry = Pick<UserGameEntry, "currentPlayingSlot" | "playtimeSource" | "updatedAt">;

export function chooseDisplayedGameEntry<T extends DisplayEntry>(entries: T[]): T | null {
  return entries.find((entry) => entry.currentPlayingSlot !== null) ??
    entries.find((entry) => entry.playtimeSource === "manual") ??
    [...entries].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
}

// Bound public nested reads while allowing copies on different platforms.
const entriesPerGame = 64;
export const COMMUNITY_SHELF_LIMIT = 6;

/** Reading a game never refreshes providers or mutates another user's data. */
export async function readGameDetail(db: PrismaClient, slug: string, userId: string | null) {
  const game = await db.game.findUnique({
    where: { slug }, include: {
      providerLinks: { omit: { rawData: true } },
      marketplaceSnapshots: {
        where: { checkedAt: { not: null } },
        select: { region: true, offers: true, subscriptions: true, checkedAt: true },
      },
      steamReviewSnapshots: {
        select: { language: true, appId: true, reviews: true, summary: true, checkedAt: true },
      },
    },
  });
  if (!game) return null;

  const [userEntries, userReviews, communityUsers] = await Promise.all([
    userId ? db.userGameEntry.findMany({
      where: { gameId: game.id, userId },
      omit: { rawData: true },
      include: { user: { select: { onboardingAnswers: true } } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: entriesPerGame,
    }) : [],
    userId ? db.userGameReview.findMany({
      where: { gameId: game.id, userId },
      select: {
        id: true, userId: true, provider: true, recommended: true,
        reviewedAt: true, body: true, sourceUrl: true,
      },
      orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      take: 20,
    }) : [],
    // Other players' names and activity are for signed-in members only, never
    // for anonymous visitors or search engines indexing this public page.
    userId ? db.user.findMany({
      where: {
        id: { not: userId },
        gameEntries: { some: { gameId: game.id } },
      },
      select: {
        displayName: true,
        gameEntries: {
          where: { gameId: game.id },
          select: {
            id: true, status: true, finishedAt: true, playtimeMinutes: true,
            currentPlayingSlot: true, playtimeSource: true, updatedAt: true,
          },
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          take: entriesPerGame,
        },
      },
      orderBy: { id: "asc" },
      take: COMMUNITY_SHELF_LIMIT,
    }) : [],
  ]);
  const currentEntry = chooseDisplayedGameEntry(userEntries);
  const journalEntries = userId && currentEntry ? await db.gameJournalEntry.findMany({
    where: { gameId: game.id, userId, userGameEntryId: currentEntry.id },
    select: {
      userId: true, userGameEntryId: true, occurredAt: true,
      title: true, body: true, audioTranscript: true,
    },
    orderBy: [{ occurredAt: "desc" }, { id: "asc" }],
    take: 1,
  }) : [];
  const communityEntries = communityUsers.flatMap((user) => {
    const entry = chooseDisplayedGameEntry(user.gameEntries);
    return entry ? [{ ...entry, user: { displayName: user.displayName } }] : [];
  });
  const marketplaceSnapshots = game.marketplaceSnapshots
    .map((snapshot) => parseMarketplaceSnapshot({
      region: snapshot.region,
      offers: snapshot.offers,
      subscriptions: snapshot.subscriptions,
      checkedAt: snapshot.checkedAt?.toISOString(),
    }))
    .filter((snapshot) => snapshot !== null);
  const steamReviewSnapshots = game.steamReviewSnapshots
    .map((snapshot) => snapshot.checkedAt
      ? parseSteamReviewsSnapshot({
          language: snapshot.language,
          appId: snapshot.appId,
          reviews: snapshot.reviews,
          summary: snapshot.summary,
          checkedAt: snapshot.checkedAt.toISOString(),
        })
      : null)
    .filter((snapshot) => snapshot !== null);
  return { ...game, marketplaceSnapshots, steamReviewSnapshots, userEntries, userReviews, journalEntries, communityEntries };
}

/** SEO metadata needs no library, journal, community or provider queries. */
export function readGameMetadata(db: PrismaClient, slug: string) {
  return db.game.findUnique({
    where: { slug }, select: { name: true, slug: true, ...indexableGameSelect },
  });
}

/** Database-side superset of `isIndexableGame`, so catalog scans stay narrow. */
const indexableGameWhere = {
  summary: { not: null },
  coverUrl: { not: null },
  OR: [
    { hltbMainStoryMinutes: { not: null } },
    { hltbMainExtraMinutes: { not: null } },
    { hltbCompletionistMinutes: { not: null } },
    { metacriticScore: { not: null } },
    { screenshots: { not: Prisma.DbNull } },
  ],
} satisfies Prisma.GameWhereInput;

export const SITEMAP_GAME_LIMIT = 10_000;

export async function readSitemapGames(db: PrismaClient) {
  const games = await db.game.findMany({
    where: indexableGameWhere,
    select: { slug: true, updatedAt: true, ...indexableGameSelect },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: SITEMAP_GAME_LIMIT,
  });
  return games.filter(isIndexableGame).map(({ slug, updatedAt }) => ({ slug, updatedAt }));
}

export const RELATED_GAMES_LIMIT = 6;
/** Prepared discovery: public fields only, no provider requests or writes. */
export async function readRelatedGames(
  db: PrismaClient,
  game: { id: string; genres: Prisma.JsonValue | null },
) {
  const source = await db.game.findUnique({ where: { id: game.id }, select: { igdbId: true } });
  if (!source?.igdbId) return [];
  const link = await db.gameProviderLink.findUnique({
    where: { provider_providerGameId: { provider: "IGDB", providerGameId: String(source.igdbId) } },
    select: { gameId: true, rawData: true },
  });
  if (link?.gameId !== game.id) return [];
  const snapshot = readDiscoverySnapshot(link.rawData);
  if (!snapshot || snapshot.profile.igdbId !== source.igdbId || !snapshot.recommendations.length) return [];
  const candidates = await db.game.findMany({
    where: { id: { in: snapshot.recommendations.map(item => item.gameId), not: game.id } },
    select: { id: true, slug: true, name: true, coverUrl: true }, take: RELATED_GAMES_LIMIT,
  });
  const seen = new Set<string>();
  return snapshot.recommendations.flatMap(item => {
    const candidate = candidates.find(game => game.id === item.gameId);
    if (!candidate?.coverUrl || looksLikeGameExtra(candidate.name) || seen.has(candidate.id)) return [];
    seen.add(candidate.id);
    return [{ slug: candidate.slug, name: candidate.name, coverUrl: candidate.coverUrl, reason: item.reason }];
  });
}

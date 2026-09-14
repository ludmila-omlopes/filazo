import { UserGameStatus, type PrismaClient, type UserGameEntry } from "@prisma/client";

type DisplayEntry = Pick<UserGameEntry, "currentPlayingSlot" | "playtimeSource" | "updatedAt">;

export function chooseDisplayedGameEntry<T extends DisplayEntry>(entries: T[]): T | null {
  return entries.find((entry) => entry.currentPlayingSlot !== null) ??
    entries.find((entry) => entry.playtimeSource === "manual") ??
    [...entries].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
}

// One entry per game/status is enforced by the database's unique constraint.
const entriesPerGame = Object.keys(UserGameStatus).length;
export const COMMUNITY_SHELF_LIMIT = 6;

/** Reading a game never refreshes providers or mutates another user's data. */
export async function readGameDetail(db: PrismaClient, slug: string, userId: string | null) {
  const game = await db.game.findUnique({
    where: { slug }, include: { providerLinks: { omit: { rawData: true } } },
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
    db.user.findMany({
      where: {
        ...(userId ? { id: { not: userId } } : {}),
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
    }),
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
  return { ...game, userEntries, userReviews, journalEntries, communityEntries };
}

/** SEO metadata needs no library, journal, community or provider queries. */
export function readGameMetadata(db: PrismaClient, slug: string) {
  return db.game.findUnique({
    where: { slug }, select: { name: true, slug: true, summary: true },
  });
}

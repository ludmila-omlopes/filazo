import { NextResponse } from "next/server";
import { UserGameStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { searchIgdbGames } from "@/lib/igdb";

const ownedStatuses = new Set<UserGameStatus>([
  UserGameStatus.OWNED,
  UserGameStatus.PLAYING,
  UserGameStatus.BACKLOG,
  UserGameStatus.COMPLETED,
  UserGameStatus.DROPPED,
]);

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in before searching." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchIgdbGames(query);
  const igdbIds = results.map((result) => result.igdbId).filter(Boolean);
  const existingGames = igdbIds.length
    ? await prisma.game.findMany({
        where: {
          igdbId: {
            in: igdbIds,
          },
        },
        select: {
          id: true,
          igdbId: true,
          slug: true,
        },
      })
    : [];
  const existingSlugByIgdbId = new Map(
    existingGames.map((game) => [game.igdbId, game.slug]),
  );
  const existingGameByIgdbId = new Map(
    existingGames.map((game) => [game.igdbId, game]),
  );
  const userEntries = existingGames.length
    ? await prisma.userGameEntry.findMany({
        where: {
          userId,
          gameId: {
            in: existingGames.map((game) => game.id),
          },
        },
        select: {
          gameId: true,
          isPhysicalCopy: true,
          status: true,
          userIntent: true,
        },
      })
    : [];
  const userEntriesByGameId = new Map<string, typeof userEntries>();

  for (const entry of userEntries) {
    const entries = userEntriesByGameId.get(entry.gameId) ?? [];
    entries.push(entry);
    userEntriesByGameId.set(entry.gameId, entries);
  }

  return NextResponse.json({
    results: results.map((result) => {
      const game = result.igdbId
        ? existingGameByIgdbId.get(result.igdbId)
        : null;
      const entries = game ? userEntriesByGameId.get(game.id) ?? [] : [];
      const isOwned = entries.some(
        (entry) =>
          entry.isPhysicalCopy ||
          (entry.userIntent !== "needs_purchase" &&
            (ownedStatuses.has(entry.status) ||
              entry.status === UserGameStatus.PLAYING_NEXT)),
      );

      return {
        ...result,
        existingSlug: result.igdbId
          ? existingSlugByIgdbId.get(result.igdbId) ?? null
          : null,
        isDropped: entries.some(
          (entry) => entry.status === UserGameStatus.DROPPED,
        ),
        isOwned,
        isQueued: entries.some(
          (entry) => entry.status === UserGameStatus.PLAYING_NEXT,
        ),
      };
    }),
  });
}

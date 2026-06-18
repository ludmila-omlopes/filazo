import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { searchIgdbGames } from "@/lib/igdb";

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
          igdbId: true,
          slug: true,
        },
      })
    : [];
  const existingSlugByIgdbId = new Map(
    existingGames.map((game) => [game.igdbId, game.slug]),
  );

  return NextResponse.json({
    results: results.map((result) => ({
      ...result,
      existingSlug: result.igdbId
        ? existingSlugByIgdbId.get(result.igdbId) ?? null
        : null,
    })),
  });
}

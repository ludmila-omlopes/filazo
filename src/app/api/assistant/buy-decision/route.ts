import { NextResponse } from "next/server";
import { z } from "zod";
import { decideBuy } from "@/lib/assistant/buy-decision";
import type { AssistantEntry } from "@/lib/assistant/scoring";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const buyDecisionSchema = z.object({
  title: z.string().min(1).max(160),
  platformName: z.string().max(80).optional(),
  priceText: z.string().max(40).optional(),
  reasonUserWantsIt: z.string().max(300).optional(),
  genres: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in before using the assistant." }, { status: 401 });
  }

  const parsed = buyDecisionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid buy decision input." }, { status: 400 });
  }

  const entries = await prisma.userGameEntry.findMany({
    where: { userId },
    include: { game: true },
  });
  const assistantEntries: AssistantEntry[] = entries.map((entry) => ({
    id: entry.id,
    status: entry.status,
    source: entry.source,
    provider: entry.provider,
    playtimeMinutes: entry.playtimeMinutes,
    lastPlayedAt: entry.lastPlayedAt,
    completionPercent: entry.completionPercent,
    isFavorite: entry.isFavorite,
    activeBacklog: entry.activeBacklog,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    lastSyncedAt: entry.lastSyncedAt,
    platformName: entry.platformName,
    userIntent: entry.userIntent,
    desiredSessionMin: entry.desiredSessionMin,
    game: {
      id: entry.game.id,
      slug: entry.game.slug,
      name: entry.game.name,
      summary: entry.game.summary,
      genres: entry.game.genres,
      platforms: entry.game.platforms,
      metadataSource: entry.game.metadataSource,
      aggregatedRating: entry.game.aggregatedRating,
    },
  }));

  return NextResponse.json({
    decision: decideBuy(parsed.data, assistantEntries),
  });
}

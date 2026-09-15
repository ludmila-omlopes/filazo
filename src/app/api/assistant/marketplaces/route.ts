import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ABUSE_LIMITS } from "@/lib/abuse-policy";
import { consumeAbuseLimit } from "@/lib/abuse-limits";
import { checkApiAbuse } from "@/lib/abuse-request";
import { readLimitedJson, RequestBodyError } from "@/lib/request-body";
import { getSessionUserId } from "@/lib/session";
import { getOpenAiConfig } from "@/lib/openai";
import { AiBudgetExceededError, runWithAiBudget } from "@/lib/ai-budget";
import { MARKETPLACE_ESTIMATED_CALLS, marketplaceInputSchema, searchMarketplaces } from "@/lib/assistant/marketplace-search";
import { searchDirectMarketplaces } from "@/lib/marketplace-direct";
import { prisma } from "@/lib/prisma";
import {
  claimMarketplaceRefresh,
  findMarketplaceSnapshot,
  isMarketplaceSnapshotFresh,
  marketplaceSnapshotToResult,
  releaseMarketplaceRefresh,
  saveMarketplaceSnapshot,
} from "@/lib/marketplace-cache";

export const maxDuration = 90;

const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
};

function refreshingResult(
  input: { region: "BR" | "US" | "PT" | "CA" | "GB" },
  snapshot: Awaited<ReturnType<typeof findMarketplaceSnapshot>>,
) {
  return marketplaceSnapshotToResult(snapshot, { refreshing: true }) ?? {
    offers: [],
    subscriptions: [],
    region: input.region,
    checkedAt: new Date().toISOString(),
    refreshing: true,
  };
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const limited = await checkApiAbuse([ABUSE_LIMITS.assistant], userId);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await readLimitedJson(request, 8 * 1024);
  } catch (error) {
    return NextResponse.json({ code: "INVALID_INPUT" }, { status: error instanceof RequestBodyError ? error.status : 400 });
  }
  const parsed = marketplaceInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  const { gameId, ...requestedInput } = parsed.data;
  let searchInput = requestedInput;
  let snapshot: Awaited<ReturnType<typeof findMarketplaceSnapshot>> = null;
  if (gameId) {
    const game = await prisma.game.findUnique({ where: { id: gameId }, select: { name: true } });
    if (!game) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    searchInput = { ...requestedInput, title: game.name };
    snapshot = await findMarketplaceSnapshot(gameId, requestedInput.region);
    if (isMarketplaceSnapshotFresh(snapshot)) {
      const cached = marketplaceSnapshotToResult(snapshot);
      if (cached) return NextResponse.json(cached, { headers: PUBLIC_CACHE_HEADERS });
    }
  }
  const config = gameId ? null : getOpenAiConfig();
  if (!gameId && !config) return NextResponse.json({ code: "NOT_CONFIGURED" }, { status: 503 });
  const refreshToken = gameId ? randomUUID() : null;
  let refreshClaimed = false;
  try {
    if (gameId && refreshToken) {
      refreshClaimed = await claimMarketplaceRefresh({
        gameId,
        region: requestedInput.region,
        token: refreshToken,
      });
      if (!refreshClaimed) {
        snapshot = await findMarketplaceSnapshot(gameId, requestedInput.region);
        const latest = marketplaceSnapshotToResult(snapshot);
        if (latest && isMarketplaceSnapshotFresh(snapshot)) {
          return NextResponse.json(latest, { headers: PUBLIC_CACHE_HEADERS });
        }
        return NextResponse.json(refreshingResult(requestedInput, snapshot), {
          status: 202,
          headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
        });
      }

      const refreshLimit = await consumeAbuseLimit(
        ABUSE_LIMITS.marketplaceRefresh,
        `game:${gameId}`,
      );
      if (!refreshLimit.allowed) {
        await releaseMarketplaceRefresh(gameId, requestedInput.region, refreshToken);
        refreshClaimed = false;
        return NextResponse.json({
          code: refreshLimit.status === 429 ? "GAME_REFRESH_LIMIT" : "LIMIT_UNAVAILABLE",
        }, {
          status: refreshLimit.status,
          headers: { "Retry-After": String(refreshLimit.retryAfter), "Cache-Control": "no-store" },
        });
      }
    }
    const result = gameId
      ? await searchDirectMarketplaces({ gameId, input: searchInput, signal: request.signal })
      : await runWithAiBudget({
          userId,
          feature: "assistant_marketplace",
          countedCalls: MARKETPLACE_ESTIMATED_CALLS,
          model: config!.model,
          estimatedInputTokens: 120000,
          estimatedOutputTokens: 40000,
          inputSummary: searchInput,
          execute: () => searchMarketplaces(searchInput, config!, request.signal),
        });
    if (gameId && refreshToken) {
      await saveMarketplaceSnapshot(result, gameId, refreshToken);
      refreshClaimed = false;
      return NextResponse.json(result, { headers: PUBLIC_CACHE_HEADERS });
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AiBudgetExceededError) return NextResponse.json({ code: "AI_LIMIT" }, { status: 429 });
    console.error("Marketplace search failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ code: "SEARCH_FAILED" }, { status: 502 });
  } finally {
    if (gameId && refreshToken && refreshClaimed) {
      await releaseMarketplaceRefresh(gameId, requestedInput.region, refreshToken);
    }
  }
}

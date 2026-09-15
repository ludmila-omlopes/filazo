import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ExternalProvider } from "@prisma/client";
import { ABUSE_LIMITS, getClientNetwork } from "@/lib/abuse-policy";
import { checkApiAbuse } from "@/lib/abuse-request";
import { consumeAbuseLimit } from "@/lib/abuse-limits";
import { readLimitedJson, RequestBodyError } from "@/lib/request-body";
import { getSessionUserId } from "@/lib/session";
import { fetchSteamReviews, readSteamAppId, steamReviewLanguage } from "@/lib/steam-reviews";
import {
  claimSteamReviewsRefresh,
  findSteamReviewsSnapshot,
  isSteamReviewsSnapshotFresh,
  releaseSteamReviewsRefresh,
  saveSteamReviewsSnapshot,
  steamReviewsSnapshotToResult,
} from "@/lib/steam-reviews-cache";
import { prisma } from "@/lib/prisma";

export const maxDuration = 45;

const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
};

const requestSchema = z.object({
  locale: z.enum(["en", "pt-BR"]).default("en"),
});

const EMPTY_SUMMARY = {
  reviewScore: null,
  reviewScoreDesc: null,
  totalReviews: null,
  totalPositive: null,
  totalNegative: null,
};

function refreshingResult(
  appId: string,
  language: ReturnType<typeof steamReviewLanguage>,
  snapshot: Awaited<ReturnType<typeof findSteamReviewsSnapshot>>,
) {
  return steamReviewsSnapshotToResult(snapshot, { refreshing: true }) ?? {
    appId,
    summary: EMPTY_SUMMARY,
    reviews: [],
    checkedAt: new Date().toISOString(),
    refreshing: true,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      providerLinks: {
        where: { provider: ExternalProvider.STEAM },
        select: { providerGameId: true, storeUrl: true },
      },
    },
  });
  if (!game) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 404 });

  const appId = readSteamAppId(game.providerLinks);
  if (!appId) return NextResponse.json({ code: "NO_STEAM" }, { status: 404 });

  let body: unknown;
  try {
    body = await readLimitedJson(request, 2 * 1024);
  } catch (error) {
    return NextResponse.json({ code: "INVALID_INPUT" }, {
      status: error instanceof RequestBodyError ? error.status : 400,
    });
  }
  const parsedBody = requestSchema.safeParse(body);
  if (!parsedBody.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  const language = steamReviewLanguage(parsedBody.data.locale);

  const snapshot = await findSteamReviewsSnapshot(gameId, language);
  if (isSteamReviewsSnapshotFresh(snapshot)) {
    const cached = steamReviewsSnapshotToResult(snapshot);
    if (cached) return NextResponse.json(cached, { headers: PUBLIC_CACHE_HEADERS });
  }

  const sessionUserId = await getSessionUserId();
  const identity = sessionUserId ?? getClientNetwork(await headers());
  const burstLimit = await checkApiAbuse([ABUSE_LIMITS.steamReviewsBurst], identity);
  if (burstLimit) return burstLimit;

  const refreshToken = randomUUID();
  let refreshClaimed = false;
  try {
    refreshClaimed = await claimSteamReviewsRefresh({ gameId, language, appId, token: refreshToken });
    if (!refreshClaimed) {
      const latestSnapshot = await findSteamReviewsSnapshot(gameId, language);
      const latest = steamReviewsSnapshotToResult(latestSnapshot);
      if (latest && isSteamReviewsSnapshotFresh(latestSnapshot)) {
        return NextResponse.json(latest, { headers: PUBLIC_CACHE_HEADERS });
      }
      return NextResponse.json(refreshingResult(appId, language, latestSnapshot), {
        status: 202,
        headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
      });
    }

    const refreshLimit = await consumeAbuseLimit(
      ABUSE_LIMITS.steamReviewsRefresh,
      `game:${gameId}`,
    );
    if (!refreshLimit.allowed) {
      await releaseSteamReviewsRefresh(gameId, language, refreshToken);
      refreshClaimed = false;
      return NextResponse.json({
        code: refreshLimit.status === 429 ? "STEAM_REVIEWS_LIMIT" : "LIMIT_UNAVAILABLE",
      }, {
        status: refreshLimit.status,
        headers: { "Retry-After": String(refreshLimit.retryAfter), "Cache-Control": "no-store" },
      });
    }

    const result = await fetchSteamReviews({
      appId,
      language,
      signal: request.signal,
    });
    await saveSteamReviewsSnapshot(result, gameId, refreshToken);
    refreshClaimed = false;
    return NextResponse.json(result, { headers: PUBLIC_CACHE_HEADERS });
  } catch (error) {
    console.error("Steam review search failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ code: "STEAM_REVIEWS_FAILED" }, { status: 502 });
  } finally {
    if (refreshClaimed) await releaseSteamReviewsRefresh(gameId, language, refreshToken);
  }
}

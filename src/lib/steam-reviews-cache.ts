import { Prisma } from "@prisma/client";
import {
  parseSteamReviewsSnapshot,
  type SteamReviewLanguage,
  type SteamReviewsResult,
  type SteamReviewsSnapshot,
} from "@/lib/steam-reviews";
import { prisma } from "@/lib/prisma";

export const STEAM_REVIEWS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const STEAM_REVIEWS_REFRESH_LEASE_MS = 2 * 60 * 1000;

type SteamReviewsSnapshotRecord = {
  gameId: string;
  language: string;
  appId: string;
  reviews: Prisma.JsonValue;
  summary: Prisma.JsonValue;
  checkedAt: Date | null;
  refreshLeaseToken: string | null;
  refreshLeaseExpiresAt: Date | null;
};

export function isSteamReviewsSnapshotFresh(
  snapshot: Pick<SteamReviewsSnapshotRecord, "checkedAt"> | null,
  now = new Date(),
) {
  return Boolean(
    snapshot?.checkedAt &&
      now.getTime() - snapshot.checkedAt.getTime() < STEAM_REVIEWS_CACHE_TTL_MS,
  );
}

export function steamReviewsSnapshotToResult(
  snapshot: Pick<SteamReviewsSnapshotRecord, "appId" | "language" | "reviews" | "summary" | "checkedAt"> | null,
  options: Pick<SteamReviewsResult, "refreshing" | "unavailable"> = {},
): SteamReviewsResult | null {
  if (!snapshot?.checkedAt) return null;
  const parsed = parseSteamReviewsSnapshot({
    appId: snapshot.appId,
    language: snapshot.language,
    reviews: snapshot.reviews,
    summary: snapshot.summary,
    checkedAt: snapshot.checkedAt.toISOString(),
  });
  return parsed ? { ...parsed, ...options } : null;
}

export async function findSteamReviewsSnapshot(gameId: string, language: SteamReviewLanguage) {
  return prisma.gameSteamReviewSnapshot.findUnique({
    where: { gameId_language: { gameId, language } },
    select: {
      gameId: true,
      language: true,
      appId: true,
      reviews: true,
      summary: true,
      checkedAt: true,
      refreshLeaseToken: true,
      refreshLeaseExpiresAt: true,
    },
  });
}

const EMPTY_SUMMARY = {
  reviewScore: null,
  reviewScoreDesc: null,
  totalReviews: null,
  totalPositive: null,
  totalNegative: null,
};

export async function claimSteamReviewsRefresh({
  gameId,
  language,
  appId,
  token,
  now = new Date(),
}: {
  gameId: string;
  language: SteamReviewLanguage;
  appId: string;
  token: string;
  now?: Date;
}) {
  const leaseExpiresAt = new Date(now.getTime() + STEAM_REVIEWS_REFRESH_LEASE_MS);
  const staleBefore = new Date(now.getTime() - STEAM_REVIEWS_CACHE_TTL_MS);
  try {
    await prisma.gameSteamReviewSnapshot.create({
      data: {
        gameId,
        language,
        appId,
        reviews: [],
        summary: EMPTY_SUMMARY,
        checkedAt: null,
        refreshLeaseToken: token,
        refreshLeaseExpiresAt: leaseExpiresAt,
      },
    });
    return true;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
  }

  const claimed = await prisma.gameSteamReviewSnapshot.updateMany({
    where: {
      gameId,
      language,
      OR: [
        { refreshLeaseExpiresAt: null },
        { refreshLeaseExpiresAt: { lt: now } },
      ],
      AND: [{
        OR: [
          { appId: { not: appId } },
          { checkedAt: null },
          { checkedAt: { lt: staleBefore } },
        ],
      }],
    },
    data: {
      appId,
      refreshLeaseToken: token,
      refreshLeaseExpiresAt: leaseExpiresAt,
    },
  });
  return claimed.count > 0;
}

export async function releaseSteamReviewsRefresh(
  gameId: string,
  language: SteamReviewLanguage,
  token: string,
) {
  await prisma.gameSteamReviewSnapshot.updateMany({
    where: { gameId, language, refreshLeaseToken: token },
    data: { refreshLeaseToken: null, refreshLeaseExpiresAt: null },
  });
}

export async function saveSteamReviewsSnapshot(
  result: SteamReviewsSnapshot,
  gameId: string,
  token: string,
) {
  const checkedAt = new Date(result.checkedAt);
  if (!Number.isFinite(checkedAt.getTime())) throw new Error("Invalid Steam review timestamp.");
  const saved = await prisma.gameSteamReviewSnapshot.updateMany({
    where: {
      gameId,
      language: result.language,
      refreshLeaseToken: token,
    },
    data: {
      appId: result.appId,
      reviews: result.reviews as unknown as Prisma.InputJsonValue,
      summary: result.summary as unknown as Prisma.InputJsonValue,
      checkedAt,
      refreshLeaseToken: null,
      refreshLeaseExpiresAt: null,
    },
  });
  if (!saved.count) throw new Error("Steam review refresh lease was lost.");
}

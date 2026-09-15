import { Prisma } from "@prisma/client";
import {
  parseMarketplaceSnapshot,
  type MarketplaceInput,
  type MarketplaceResult,
} from "@/lib/assistant/marketplace-search";
import { prisma } from "@/lib/prisma";

// A successful lookup is public for six hours. The refresh limit below still
// applies when a caller explicitly asks for fresher data.
export const MARKETPLACE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MARKETPLACE_REFRESH_LEASE_MS = 2 * 60 * 1000;

type MarketplaceSnapshotRecord = {
  gameId: string;
  region: string;
  offers: Prisma.JsonValue;
  subscriptions: Prisma.JsonValue;
  checkedAt: Date | null;
  refreshLeaseToken: string | null;
  refreshLeaseExpiresAt: Date | null;
};

export function isMarketplaceSnapshotFresh(
  snapshot: Pick<MarketplaceSnapshotRecord, "checkedAt"> | null,
  now = new Date(),
) {
  return Boolean(
    snapshot?.checkedAt &&
      now.getTime() - snapshot.checkedAt.getTime() < MARKETPLACE_CACHE_TTL_MS,
  );
}

export function marketplaceSnapshotToResult(
  snapshot: Pick<MarketplaceSnapshotRecord, "region" | "offers" | "subscriptions" | "checkedAt"> | null,
  options: { refreshing?: boolean } = {},
): MarketplaceResult | null {
  if (!snapshot?.checkedAt) return null;
  const parsed = parseMarketplaceSnapshot({
    region: snapshot.region,
    offers: snapshot.offers,
    subscriptions: snapshot.subscriptions,
    checkedAt: snapshot.checkedAt.toISOString(),
  });
  return parsed ? { ...parsed, ...options } : null;
}

export async function findMarketplaceSnapshot(
  gameId: string,
  region: MarketplaceInput["region"],
) {
  return prisma.gameMarketplaceSnapshot.findUnique({
    where: { gameId_region: { gameId, region } },
    select: {
      gameId: true,
      region: true,
      offers: true,
      subscriptions: true,
      checkedAt: true,
      refreshLeaseToken: true,
      refreshLeaseExpiresAt: true,
    },
  });
}

export async function claimMarketplaceRefresh({
  gameId,
  region,
  token,
  now = new Date(),
}: {
  gameId: string;
  region: MarketplaceInput["region"];
  token: string;
  now?: Date;
}) {
  const leaseExpiresAt = new Date(now.getTime() + MARKETPLACE_REFRESH_LEASE_MS);
  const staleBefore = new Date(now.getTime() - MARKETPLACE_CACHE_TTL_MS);
  try {
    await prisma.gameMarketplaceSnapshot.create({
      data: {
        gameId,
        region,
        offers: [],
        subscriptions: [],
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

  const claimed = await prisma.gameMarketplaceSnapshot.updateMany({
    where: {
      gameId,
      region,
      OR: [
        { refreshLeaseExpiresAt: null },
        { refreshLeaseExpiresAt: { lt: now } },
      ],
      AND: [{
        OR: [
          { checkedAt: null },
          { checkedAt: { lt: staleBefore } },
        ],
      }],
    },
    data: {
      refreshLeaseToken: token,
      refreshLeaseExpiresAt: leaseExpiresAt,
    },
  });
  return claimed.count > 0;
}

export async function releaseMarketplaceRefresh(gameId: string, region: string, token: string) {
  await prisma.gameMarketplaceSnapshot.updateMany({
    where: { gameId, region, refreshLeaseToken: token },
    data: { refreshLeaseToken: null, refreshLeaseExpiresAt: null },
  });
}

export async function saveMarketplaceSnapshot(
  result: MarketplaceResult,
  gameId: string,
  token: string,
) {
  const checkedAt = new Date(result.checkedAt);
  if (!Number.isFinite(checkedAt.getTime())) throw new Error("Invalid marketplace timestamp.");
  const saved = await prisma.gameMarketplaceSnapshot.updateMany({
    where: {
      gameId,
      region: result.region,
      refreshLeaseToken: token,
    },
    data: {
      offers: result.offers as unknown as Prisma.InputJsonValue,
      subscriptions: result.subscriptions as unknown as Prisma.InputJsonValue,
      checkedAt,
      refreshLeaseToken: null,
      refreshLeaseExpiresAt: null,
    },
  });
  if (!saved.count) throw new Error("Marketplace refresh lease was lost.");
}

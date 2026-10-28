import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveCatalogGame } from "@/lib/catalog";
import { fetchIgdbDiscovery } from "@/lib/igdb";
import { discoverySnapshotSchema, scoreGameAffinity, type AffinityReason } from "@/lib/game-affinity";
import { looksLikeGameExtra } from "@/lib/game-indexing";

export function discoveryWorkerScope(scope: string) { return `${scope}:discovery`; }

// Similar games change rarely. Stale snapshots stay readable until refreshed.
export const DISCOVERY_REFRESH_MS = 60 * 86_400_000;
// Once every library game has a row, seeding finds nothing and stops here.
const DISCOVERY_SEED_BATCH = 200;

/**
 * Only workers enqueue global discovery; page reads never write or call providers.
 * Sources are games kept in at least one library. Games imported only as
 * recommendations never become sources, so discovery cannot crawl the
 * provider's whole similarity graph. Each source keeps one queue row that is
 * rescheduled after success, so seeding never scans provider JSON.
 */
export async function seedDiscoveryJobs(workerScope: string, now = new Date()) {
  if (!process.env.IGDB_CLIENT_ID || !process.env.IGDB_CLIENT_SECRET) return;
  const games = await prisma.game.findMany({
    where: {
      igdbId: { not: null }, coverUrl: { not: null },
      userEntries: { some: {} },
      metadataJobs: { none: { workerScope } },
    },
    select: { id: true }, take: DISCOVERY_SEED_BATCH,
    orderBy: [{ totalRatingCount: { sort: "desc", nulls: "last" } }, { id: "asc" }],
  });
  if (!games.length) return;
  // Snapshots prepared before sources kept queue rows retain their schedule.
  const links = await prisma.gameProviderLink.findMany({
    where: { provider: "IGDB", gameId: { in: games.map(game => game.id) } },
    select: { gameId: true, rawData: true },
  });
  const refreshAt = new Map<string, number>();
  for (const link of links) {
    const at = readDiscoveryRefreshAfter(link.rawData);
    if (at !== null && at > now.getTime()) refreshAt.set(link.gameId, Math.max(at, refreshAt.get(link.gameId) ?? 0));
  }
  await prisma.gameMetadataJob.createMany({
    data: games.map(game => ({ gameId: game.id, workerScope, nextAttemptAt: new Date(refreshAt.get(game.id) ?? now.getTime()) })),
    skipDuplicates: true,
  });
}

function readDiscoveryRefreshAfter(rawData: Prisma.JsonValue | null) {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) return null;
  const discovery = rawData.gameDiscovery;
  if (!discovery || typeof discovery !== "object" || Array.isArray(discovery)) return null;
  const at = typeof discovery.refreshAfter === "string" ? Date.parse(discovery.refreshAfter) : NaN;
  return Number.isFinite(at) ? at : null;
}

/** Publishes a snapshot and returns when to refresh it, or null if the game is no longer a source. */
export async function prepareGameDiscovery(gameId: string, workerScope: string, token: string, signal: AbortSignal) {
  const assertLease = async () => {
    signal.throwIfAborted();
    const owned = await prisma.gameMetadataJob.count({ where: {
      gameId, workerScope, workerToken: token, leaseExpiresAt: { gt: new Date() },
    } });
    if (!owned) throw new Error("Discovery worker lease expired.");
  };
  await assertLease();
  // Existence check only: no personal fields are read.
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: {
    igdbId: true, userEntries: { select: { id: true }, take: 1 },
  } });
  // A game removed from every library stops being refreshed (no provider call).
  if (!game?.igdbId || !game.userEntries.length) return null;
  const discovery = await fetchIgdbDiscovery(game.igdbId, signal);
  if (!discovery) throw new Error("Discovery provider not configured.");
  const ranked = discovery.games
    .filter(item => item.metadata.coverUrl && !looksLikeGameExtra(item.metadata.name))
    .flatMap(item => {
      const affinity = scoreGameAffinity(discovery.profile, item.profile);
      return affinity ? [{ ...item, ...affinity }] : [];
    })
    .sort((a, b) => b.score - a.score || (b.metadata.totalRatingCount ?? 0) - (a.metadata.totalRatingCount ?? 0) || a.profile.igdbId - b.profile.igdbId);
  const families = new Set<number>();
  const selected = ranked.filter(candidate => {
    if (families.has(candidate.familyId)) return false;
    families.add(candidate.familyId);
    return true;
  }).slice(0, 6);
  const recommendations: { gameId: string; score: number; reason: AffinityReason }[] = [];
  for (const candidate of selected) {
    await assertLease();
    const canonical = await resolveCatalogGame({
      title: candidate.metadata.name, provider: "IGDB", providerGameId: String(candidate.profile.igdbId),
      metadata: candidate.metadata, deferEnrichment: true,
    });
    if (canonical.id !== gameId && !recommendations.some(item => item.gameId === canonical.id)) {
      recommendations.push({ gameId: canonical.id, score: candidate.score, reason: candidate.reason });
    }
  }
  const refreshAfter = new Date(Date.now() + DISCOVERY_REFRESH_MS);
  const snapshot = discoverySnapshotSchema.parse({
    version: 1, profile: discovery.profile, recommendations,
    refreshAfter: refreshAfter.toISOString(),
  });
  await assertLease();
  await prisma.$transaction(async tx => {
    // The queue claim gates publication, including concurrent expired workers.
    const claimed = await tx.gameMetadataJob.updateMany({
      where: { gameId, workerScope, workerToken: token, leaseExpiresAt: { gt: new Date() } },
      data: { leaseExpiresAt: new Date(Date.now() + 30_000) },
    });
    if (!claimed.count) throw new Error("Discovery worker lease expired.");
    const currentGame = await tx.game.findUnique({ where: { id: gameId }, select: { igdbId: true } });
    if (currentGame?.igdbId !== snapshot.profile.igdbId) throw new Error("Discovery game identity changed.");
    const where = { provider_providerGameId: { provider: "IGDB" as const, providerGameId: String(game.igdbId) } };
    const link = await tx.gameProviderLink.findUnique({ where });
    if (link && link.gameId !== gameId) throw new Error("Conflicting discovery catalog identity.");
    const raw = link?.rawData && typeof link.rawData === "object" && !Array.isArray(link.rawData) ? link.rawData : {};
    const rawData = JSON.parse(JSON.stringify({ ...raw, gameDiscovery: snapshot })) as Prisma.InputJsonValue;
    await tx.gameProviderLink.upsert({ where,
      create: { provider: "IGDB", providerGameId: String(game.igdbId), gameId, rawData },
      update: { rawData },
    });
  });
  return { refreshAfter };
}

import type { Prisma, UserGameStatus } from "@prisma/client";
import {
  hasIgdbConfig,
  searchUpcomingRelatedIgdbReleases,
  type IgdbUpcomingReleaseLookup,
} from "@/lib/igdb";
import { prisma } from "@/lib/prisma";
import { isEntryFinished } from "@/lib/time-estimates";

const RELEASE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RELEASE_LOOKUP_HORIZON_DAYS = 365;
const MAX_RELEASE_LOOKUPS_PER_RUN = 6;

type ReleaseRefreshEntry = {
  status: UserGameStatus | `${UserGameStatus}`;
  finishedAt?: Date | null;
  game: {
    id: string;
    name: string;
    igdbId?: number | null;
    upcomingReleasesCheckedAt?: Date | null;
  };
};

export type UpcomingReleaseCache = IgdbUpcomingReleaseLookup & {
  version: 1;
  checkedAt: string;
  horizonDays: number;
};

export type UpcomingReleaseRefreshSummary = {
  checkedCount: number;
  updatedCount: number;
  failedCount: number;
  skippedReason: "IGDB_UNCONFIGURED" | "NO_STALE_FINISHED_GAMES" | null;
};

function isReleaseCacheStale(
  checkedAt: Date | null | undefined,
  now: Date,
) {
  return (
    !checkedAt ||
    now.getTime() - checkedAt.getTime() >= RELEASE_CACHE_TTL_MS
  );
}

function fallbackCacheForGame(
  game: ReleaseRefreshEntry["game"],
  now: Date,
): UpcomingReleaseCache {
  return {
    version: 1,
    source: "IGDB",
    checkedAt: now.toISOString(),
    horizonDays: RELEASE_LOOKUP_HORIZON_DAYS,
    sourceGame: {
      igdbId: game.igdbId ?? 0,
      name: game.name,
      slug: null,
      url: null,
    },
    relationKeys: {
      franchiseNames: [],
      collectionNames: [],
    },
    releases: [],
  };
}

function buildCache(
  lookup: IgdbUpcomingReleaseLookup,
  now: Date,
): UpcomingReleaseCache {
  return {
    version: 1,
    checkedAt: now.toISOString(),
    horizonDays: RELEASE_LOOKUP_HORIZON_DAYS,
    ...lookup,
  };
}

function getRefreshSeeds(entries: ReleaseRefreshEntry[], now: Date) {
  const seedByGameId = new Map<string, ReleaseRefreshEntry["game"]>();

  for (const entry of entries) {
    if (
      !isEntryFinished(entry) ||
      !entry.game.igdbId ||
      !isReleaseCacheStale(entry.game.upcomingReleasesCheckedAt, now)
    ) {
      continue;
    }

    seedByGameId.set(entry.game.id, entry.game);
  }

  return [...seedByGameId.values()].slice(0, MAX_RELEASE_LOOKUPS_PER_RUN);
}

export async function refreshUpcomingReleaseCachesForEntries(
  entries: ReleaseRefreshEntry[],
  now = new Date(),
): Promise<UpcomingReleaseRefreshSummary> {
  if (!hasIgdbConfig()) {
    return {
      checkedCount: 0,
      updatedCount: 0,
      failedCount: 0,
      skippedReason: "IGDB_UNCONFIGURED",
    };
  }

  const seeds = getRefreshSeeds(entries, now);
  if (!seeds.length) {
    return {
      checkedCount: 0,
      updatedCount: 0,
      failedCount: 0,
      skippedReason: "NO_STALE_FINISHED_GAMES",
    };
  }

  let checkedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  for (const game of seeds) {
    checkedCount += 1;

    try {
      const lookup = game.igdbId
        ? await searchUpcomingRelatedIgdbReleases({
            horizonDays: RELEASE_LOOKUP_HORIZON_DAYS,
            igdbId: game.igdbId,
            now,
          })
        : null;
      const cache = lookup
        ? buildCache(lookup, now)
        : fallbackCacheForGame(game, now);

      await prisma.game.update({
        where: { id: game.id },
        data: {
          upcomingReleases: cache as Prisma.InputJsonValue,
          upcomingReleasesCheckedAt: now,
        },
      });
      updatedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.warn("Could not refresh upcoming release cache.", {
        gameId: game.id,
        error,
      });
    }
  }

  return {
    checkedCount,
    updatedCount,
    failedCount,
    skippedReason: null,
  };
}

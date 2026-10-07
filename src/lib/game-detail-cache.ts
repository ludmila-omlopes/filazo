import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  readGameExperience,
  readGameMetadata,
  readPublicGameDetail,
  readRelatedGames,
  type PublicGameDetail,
} from "@/lib/game-detail-queries";

// This app does not enable Cache Components; use its existing Data Cache API.
// Keep HTML dynamic: sessions, locale, journals and library state are not shared.
const PUBLIC_GAME_CACHE_SECONDS = 300;
class MissingPublicGame extends Error {}

async function nullableGame<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof MissingPublicGame) return null;
    throw error;
  }
}

const readCachedPublicGame = unstable_cache(async (slug: string) => {
  const game = await readPublicGameDetail(prisma, slug);
  // Do not persist a 404: a subsequent import may create this canonical slug.
  if (!game) throw new MissingPublicGame();
  return JSON.stringify(game);
}, ["public-game-detail-v1"], { revalidate: PUBLIC_GAME_CACHE_SECONDS });

function restorePublicGame(serialized: string): PublicGameDetail {
  const game: PublicGameDetail = JSON.parse(serialized);
  // Restore Prisma dates only at known schema fields; provider JSON and parsed
  // marketplace/review snapshots keep their original ISO strings.
  const date = (value: Date) => new Date(value as unknown as string);
  const optionalDate = (value: Date | null) => value === null ? null : date(value);
  return {
    ...game,
    releaseDate: optionalDate(game.releaseDate),
    completionModelCheckedAt: optionalDate(game.completionModelCheckedAt),
    igdbCheckedAt: optionalDate(game.igdbCheckedAt),
    hltbUpdatedAt: optionalDate(game.hltbUpdatedAt),
    hltbCheckedAt: optionalDate(game.hltbCheckedAt),
    metacriticUpdatedAt: optionalDate(game.metacriticUpdatedAt),
    metacriticCheckedAt: optionalDate(game.metacriticCheckedAt),
    upcomingReleasesCheckedAt: optionalDate(game.upcomingReleasesCheckedAt),
    createdAt: date(game.createdAt),
    updatedAt: date(game.updatedAt),
    providerLinks: game.providerLinks.map(link => ({
      ...link,
      storyAchievementCheckedAt: optionalDate(link.storyAchievementCheckedAt),
      createdAt: date(link.createdAt),
      updatedAt: date(link.updatedAt),
    })),
  };
}

const getPublicGame = cache((slug: string) => nullableGame(async () =>
  restorePublicGame(await readCachedPublicGame(slug)),
));

/** Only the public part is shared; every visit reads fresh user-scoped state. */
export async function getCachedGameDetail(slug: string, userId: string | null) {
  const game = await getPublicGame(slug);
  return game ? { ...game, ...await readGameExperience(prisma, game.id, userId) } : null;
}

const readCachedMetadata = unstable_cache(async (slug: string) => {
  const game = await readGameMetadata(prisma, slug);
  if (!game) throw new MissingPublicGame();
  return game;
}, ["public-game-metadata-v1"], { revalidate: PUBLIC_GAME_CACHE_SECONDS });

export const getCachedGameMetadata = cache((slug: string) =>
  nullableGame(() => readCachedMetadata(slug)),
);

export const getCachedRelatedGames = unstable_cache((gameId: string) =>
  readRelatedGames(prisma, { id: gameId, genres: null }),
["public-related-games-v1"], { revalidate: PUBLIC_GAME_CACHE_SECONDS });

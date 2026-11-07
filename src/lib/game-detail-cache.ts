import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { publicGameTag } from "@/lib/public-game-cache";
import {
  readGameExperience,
  readGameMetadata,
  readPublicGameDetail,
  readRelatedGames,
  type PublicGameDetail,
} from "@/lib/game-detail-queries";

// This app does not enable Cache Components; use its existing Data Cache API.
// Keep HTML dynamic: sessions, locale, journals and library state are not shared.
//
// Signed-in members already query the database on every request (the layout
// loads their account), so their public copy is at most five minutes old.
// Anonymous visits are mostly crawlers spread over the whole day, and any one
// that reaches the database keeps Neon from scaling to zero. Their copy never
// expires by time: writers call revalidateGamePage() and the next visit
// rebuilds it.
const MEMBER_CACHE_SECONDS = 300;
type Audience = "member" | "visitor";
class MissingPublicGame extends Error {}

function cacheOptions(slug: string, audience: Audience) {
  return {
    revalidate: audience === "member" ? MEMBER_CACHE_SECONDS : false,
    tags: [publicGameTag(slug)],
  } satisfies Parameters<typeof unstable_cache>[2];
}

async function nullableGame<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof MissingPublicGame) return null;
    throw error;
  }
}

async function loadPublicGame(slug: string) {
  const game = await readPublicGameDetail(prisma, slug);
  // Do not persist a 404: a subsequent import may create this canonical slug.
  if (!game) throw new MissingPublicGame();
  return JSON.stringify(game);
}

async function loadGameMetadata(slug: string) {
  const game = await readGameMetadata(prisma, slug);
  if (!game) throw new MissingPublicGame();
  return game;
}

function loadRelatedGames(gameId: string) {
  return readRelatedGames(prisma, { id: gameId, genres: null });
}

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

const getPublicGame = cache((slug: string, audience: Audience) => nullableGame(async () => {
  const read = unstable_cache(loadPublicGame, [`public-game-detail-${audience}-v2`], cacheOptions(slug, audience));
  return restorePublicGame(await read(slug));
}));

/** Only the public part is shared; every visit reads fresh user-scoped state. */
export async function getCachedGameDetail(slug: string, userId: string | null) {
  const game = await getPublicGame(slug, userId ? "member" : "visitor");
  return game ? { ...game, ...await readGameExperience(prisma, game.id, userId) } : null;
}

// Metadata and related games are the same for everyone and change only when
// the game is written, so they use the long-lived copy.
export const getCachedGameMetadata = cache((slug: string) => nullableGame(() =>
  unstable_cache(loadGameMetadata, ["public-game-metadata-v2"], cacheOptions(slug, "visitor"))(slug),
));

export function getCachedRelatedGames(game: { id: string; slug: string }) {
  return unstable_cache(loadRelatedGames, ["public-related-games-v2"], cacheOptions(game.slug, "visitor"))(game.id);
}

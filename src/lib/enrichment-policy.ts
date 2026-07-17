type GameEnrichmentFields = {
  igdbId: number | null;
  summary: string | null;
  coverUrl: string | null;
  heroUrl: string | null;
  igdbCheckedAt: Date | null;
  hltbMainStoryMinutes: number | null;
  hltbMainExtraMinutes: number | null;
  hltbCompletionistMinutes: number | null;
  hltbUpdatedAt: Date | null;
  hltbCheckedAt: Date | null;
  metacriticScore: number | null;
  metacriticUpdatedAt: Date | null;
  metacriticCheckedAt: Date | null;
} | null;

const IGDB_RECHECK_MS = 1000 * 60 * 60 * 24 * 7;
const METACRITIC_REFRESH_MS = 1000 * 60 * 60 * 24 * 30;
const HLTB_REFRESH_MS = 1000 * 60 * 60 * 24 * 90;

function isFresh(checkedAt: Date | null, maxAgeMs: number, now: Date) {
  return Boolean(checkedAt) && now.getTime() - checkedAt!.getTime() < maxAgeMs;
}

export function shouldSearchIgdb(
  game: GameEnrichmentFields,
  now = new Date(),
): boolean {
  if (!game) {
    return true;
  }

  if (isFresh(game.igdbCheckedAt, IGDB_RECHECK_MS, now)) {
    return false;
  }

  return !game.igdbId || !game.summary || !game.coverUrl || !game.heroUrl;
}

export function shouldSearchHltb(
  game: GameEnrichmentFields,
  now = new Date(),
): boolean {
  if (!game) {
    return true;
  }

  const missing =
    !game.hltbMainStoryMinutes ||
    !game.hltbMainExtraMinutes ||
    !game.hltbCompletionistMinutes;
  if (!missing) {
    return false;
  }

  if (isFresh(game.hltbCheckedAt, HLTB_REFRESH_MS, now)) {
    return false;
  }

  return true;
}

export function shouldSearchMetacritic(
  game: GameEnrichmentFields,
  now = new Date(),
): boolean {
  if (!game) {
    return true;
  }

  return !isFresh(game.metacriticCheckedAt, METACRITIC_REFRESH_MS, now);
}

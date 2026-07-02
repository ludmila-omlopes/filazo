type GameEnrichmentFields = {
  igdbId: number | null;
  summary: string | null;
  coverUrl: string | null;
  heroUrl: string | null;
  hltbMainStoryMinutes: number | null;
  hltbMainExtraMinutes: number | null;
  hltbCompletionistMinutes: number | null;
  hltbUpdatedAt: Date | null;
  metacriticScore: number | null;
  metacriticUpdatedAt: Date | null;
} | null;

const METACRITIC_REFRESH_MS = 1000 * 60 * 60 * 24 * 30;
const HLTB_REFRESH_MS = 1000 * 60 * 60 * 24 * 90;

export function shouldSearchIgdb(game: GameEnrichmentFields): boolean {
  if (!game) {
    return true;
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

  if (
    game.hltbUpdatedAt &&
    now.getTime() - game.hltbUpdatedAt.getTime() < HLTB_REFRESH_MS
  ) {
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

  return (
    !game.metacriticUpdatedAt ||
    now.getTime() - game.metacriticUpdatedAt.getTime() >= METACRITIC_REFRESH_MS
  );
}

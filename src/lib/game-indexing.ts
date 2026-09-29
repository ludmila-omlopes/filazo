import type { Prisma } from "@prisma/client";

/** A couple of sentences; one-line stubs are not worth a search result. */
export const MIN_INDEXABLE_SUMMARY_LENGTH = 120;

export type IndexableGameSignals = {
  summary: string | null;
  coverUrl: string | null;
  screenshots: Prisma.JsonValue | null;
  hltbMainStoryMinutes: number | null;
  hltbMainExtraMinutes: number | null;
  hltbCompletionistMinutes: number | null;
  metacriticScore: number | null;
};

export const indexableGameSelect = {
  summary: true,
  coverUrl: true,
  screenshots: true,
  hltbMainStoryMinutes: true,
  hltbMainExtraMinutes: true,
  hltbCompletionistMinutes: true,
  metacriticScore: true,
} satisfies Prisma.GameSelect;

/**
 * Public game pages are only offered to search engines when they have enough
 * catalog detail to help a visitor. Thin pages stay reachable but `noindex`.
 */
export function isIndexableGame(game: IndexableGameSignals) {
  if ((game.summary?.trim().length ?? 0) < MIN_INDEXABLE_SUMMARY_LENGTH || !game.coverUrl) {
    return false;
  }

  return Boolean(
    game.hltbMainStoryMinutes ||
      game.hltbMainExtraMinutes ||
      game.hltbCompletionistMinutes ||
      game.metacriticScore !== null ||
      (Array.isArray(game.screenshots) && game.screenshots.length > 0),
  );
}

/** Soundtracks, skins and add-ons share a base game's metadata; skip them in discovery. */
export function looksLikeGameExtra(name: string) {
  return /\b(troph(?:y|ies)|skin|soundtrack|avatar|theme|add[\s-]?on|dlc|bundle)\b/i.test(name);
}

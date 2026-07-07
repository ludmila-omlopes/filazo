import { readStringList } from "./assistant/scoring.ts";

export type TonightMoodPick = {
  entryId: string;
  entry: {
    status: string;
    playtimeMinutes: number | null;
    remainingMinutes: number | null;
    game: { genres?: unknown };
  };
};

const COZY_GENRES = ["adventure", "casual", "simulation", "puzzle", "rpg"];
const GRIPPING_GENRES = ["action", "shooter", "horror", "strategy"];
const SHORT_REMAINING_MINUTES = 240;
const MEDIUM_REMAINING_MINUTES = 480;

/** Deterministic 32-bit FNV-1a hash for seeded, stable-in-a-day ordering. */
export function seededOrderValue(seed: string, entryId: string) {
  let hash = 0x811c9dc5;
  const input = `${seed}:${entryId}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function scoreMood(pick: TonightMoodPick, mood: string) {
  const genres = readStringList(pick.entry.game.genres).map((genre) =>
    genre.toLowerCase(),
  );

  if (mood === "short") {
    const remaining = pick.entry.remainingMinutes;
    if (remaining === null) {
      return 0;
    }
    if (remaining <= SHORT_REMAINING_MINUTES) {
      return 3;
    }
    return remaining <= MEDIUM_REMAINING_MINUTES ? 1 : 0;
  }

  if (mood === "cozy") {
    return genres.some((genre) => COZY_GENRES.includes(genre)) ? 2 : 0;
  }

  if (mood === "gripping") {
    return genres.some((genre) => GRIPPING_GENRES.includes(genre)) ? 2 : 0;
  }

  if (mood === "old-save") {
    if (pick.entry.status === "PLAYING") {
      return 3;
    }
    return (pick.entry.playtimeMinutes ?? 0) > 0 ? 2 : 0;
  }

  // "surprise" and unknown moods: flat score; ordering falls through to the
  // seeded shuffle in orderPicksForMood.
  return 0;
}

export function orderPicksForMood<T extends TonightMoodPick>(
  picks: T[],
  mood: string,
  seed: string,
): T[] {
  return [...picks].sort((left, right) => {
    const moodDelta = scoreMood(right, mood) - scoreMood(left, mood);
    if (moodDelta !== 0) {
      return moodDelta;
    }

    return (
      seededOrderValue(seed, left.entryId) -
      seededOrderValue(seed, right.entryId)
    );
  });
}

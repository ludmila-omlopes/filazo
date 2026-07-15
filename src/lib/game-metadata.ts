type EntryWithGameGenres = {
  game: {
    genres: unknown;
  };
};

export type SharedGameGenre = {
  count: number;
  name: string;
};

/** Reads JSON metadata lists safely in client and server components. */
export function readStringList(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    try {
      return readStringList(JSON.parse(value));
    } catch {
      return value.trim() ? [value.trim()] : [];
    }
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      if (item && typeof item === "object" && "name" in item) {
        return String((item as { name?: unknown }).name ?? "").trim();
      }

      return "";
    })
    .filter(Boolean);
}

/**
 * Finds the most common genre across a short list of selected games.
 * A genre is only counted once per game, even if malformed metadata repeats it.
 */
export function getSharedGameGenre(
  entries: Iterable<EntryWithGameGenres>,
): SharedGameGenre | null {
  const genres = new Map<
    string,
    SharedGameGenre & { firstSeenAt: number }
  >();
  let firstSeenAt = 0;

  for (const entry of entries) {
    const genresForGame = new Set<string>();

    for (const genre of readStringList(entry.game.genres).slice(0, 4)) {
      const normalizedGenre = genre.toLocaleLowerCase();
      if (genresForGame.has(normalizedGenre)) {
        continue;
      }

      genresForGame.add(normalizedGenre);
      const existing = genres.get(normalizedGenre);
      if (existing) {
        existing.count += 1;
      } else {
        genres.set(normalizedGenre, {
          count: 1,
          firstSeenAt,
          name: genre,
        });
        firstSeenAt += 1;
      }
    }
  }

  const sharedGenre = [...genres.values()]
    .filter((genre) => genre.count >= 2)
    .sort(
      (left, right) =>
        right.count - left.count || left.firstSeenAt - right.firstSeenAt,
    )[0];

  return sharedGenre
    ? { count: sharedGenre.count, name: sharedGenre.name }
    : null;
}

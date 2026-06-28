export type ProfileGameSort = "status" | "added" | "playtime" | "title";

type SortableProfileGameEntry = {
  createdAt: Date;
  playtimeMinutes: number | null;
  status: string;
  finishedAt: Date | null;
  game: {
    name: string;
  };
};

// Default catalog order: group games by where they sit in the play lifecycle.
// Playing first, then queued-up games, finished, backlog, wishlist, owned, and
// dropped last (dropped is hidden unless dormant entries are shown).
const STATUS_ORDER: Record<string, number> = {
  PLAYING: 0,
  PLAYING_NEXT: 1,
  FINISHED: 2,
  COMPLETED: 2,
  BACKLOG: 3,
  WISHLIST: 4,
  OWNED: 5,
  DROPPED: 6,
};

function statusRank(entry: SortableProfileGameEntry) {
  const effectiveStatus =
    entry.finishedAt && entry.status !== "COMPLETED" ? "FINISHED" : entry.status;
  return STATUS_ORDER[effectiveStatus] ?? 99;
}

export function parseProfileGameSort(value: string | undefined): ProfileGameSort {
  if (value === "added" || value === "playtime" || value === "title") {
    return value;
  }

  return "status";
}

export function sortProfileGameEntries<Entry extends SortableProfileGameEntry>(
  entries: Entry[],
  sort: ProfileGameSort,
) {
  return [...entries].sort((left, right) => {
    if (sort === "status") {
      const rankDelta = statusRank(left) - statusRank(right);
      if (rankDelta !== 0) {
        return rankDelta;
      }
      // Within a status group, surface the most recently added first.
      return right.createdAt.getTime() - left.createdAt.getTime();
    }

    if (sort === "title") {
      return left.game.name.localeCompare(right.game.name);
    }

    if (sort === "playtime") {
      const playtimeDelta =
        (right.playtimeMinutes ?? 0) - (left.playtimeMinutes ?? 0);
      if (playtimeDelta !== 0) {
        return playtimeDelta;
      }
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}

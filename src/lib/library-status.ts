// BACKLOG is accepted only as a legacy/import alias for the single shelf state.
export function normalizeLibraryStatus<T extends string>(status: T): T | "OWNED" {
  return status === "BACKLOG" ? "OWNED" : status;
}

export const LIBRARY_STATUSES = [
  "OWNED", "WISHLIST", "PLAYING", "PLAYING_NEXT", "COMPLETED", "DROPPED",
] as const;

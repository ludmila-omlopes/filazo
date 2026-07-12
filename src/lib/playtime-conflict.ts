export function getSyncedPlaytimeData(
  existing: { playtimeMinutes: number | null; playtimeSource: string | null } | null,
  syncedMinutes: number | null | undefined,
) {
  if (syncedMinutes === null || syncedMinutes === undefined) return {};
  if (existing?.playtimeSource === "manual" && existing.playtimeMinutes !== syncedMinutes) {
    return { pendingPlaytimeMinutes: syncedMinutes, pendingPlaytimeSyncedAt: new Date() };
  }
  return {
    playtimeMinutes: syncedMinutes,
    playtimeSource: "sync",
    pendingPlaytimeMinutes: null,
    pendingPlaytimeSyncedAt: null,
  };
}

export function getSyncedEntryProgressData(
  existing: { playtimeMinutes: number | null; playtimeSource: string | null } | null,
  synced: {
    completionPercent?: number | null;
    lastPlayedAt?: Date | null;
    playtimeMinutes?: number | null;
  },
) {
  return {
    ...getSyncedPlaytimeData(existing, synced.playtimeMinutes),
    ...(synced.completionPercent !== null &&
    synced.completionPercent !== undefined
      ? { completionPercent: synced.completionPercent }
      : {}),
    ...(synced.lastPlayedAt ? { lastPlayedAt: synced.lastPlayedAt } : {}),
  };
}

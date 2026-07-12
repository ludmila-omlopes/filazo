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

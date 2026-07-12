type PlanningGame = {
  name: string;
  releaseDate?: Date | null;
  hltbMainStoryMinutes?: number | null;
  hltbMainExtraMinutes?: number | null;
  hltbCompletionistMinutes?: number | null;
};

export type PlanningEntry = {
  id: string;
  status: string;
  playtimeMinutes?: number | null;
  completionPercent?: number | null;
  finishedAt?: Date | null;
  startedAt?: Date | null;
  manualStartedAt?: Date | null;
  abandonedAt?: Date | null;
  lastPlayedAt?: Date | null;
  activeBacklog?: boolean | null;
  currentPlayingSlot?: number | null;
  playingNextSlot?: number | null;
  plannedStartDate?: Date | null;
  game: PlanningGame;
};

export function getBacklogEstimate(entries: PlanningEntry[]) {
  const eligible = entries.filter((entry) => {
    if (
      entry.status === "COMPLETED" ||
      entry.status === "DROPPED" ||
      entry.abandonedAt ||
      entry.finishedAt ||
      entry.activeBacklog === false
    ) return false;

    if (entry.currentPlayingSlot !== null && entry.currentPlayingSlot !== undefined) {
      return true;
    }

    return (entry.status === "OWNED" || entry.status === "BACKLOG") &&
    !entry.startedAt &&
    !entry.lastPlayedAt &&
    !entry.playingNextSlot &&
    (entry.playtimeMinutes ?? 0) <= 0 &&
    (entry.completionPercent ?? 0) <= 0;
  });
  const estimates = eligible
    .map((entry) => entry.currentPlayingSlot !== null && entry.currentPlayingSlot !== undefined
      ? getRemainingMinutes(entry)
      : getTargetMinutes(entry.game))
    .filter((minutes): minutes is number => minutes !== null);

  return {
    minutes: estimates.reduce((total, minutes) => total + minutes, 0),
    gamesWithEstimate: estimates.length,
    eligibleGames: eligible.length,
    isPartial: estimates.length > 0 && estimates.length < eligible.length,
  };
}

export type PlayProjection = {
  entryId: string;
  kind: "current" | "next";
  startDate: Date;
  finishDate: Date;
  approximate: boolean;
};

export function weeklyHoursFromOnboarding(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 5;
  const frequency = (value as { playFrequency?: string }).playFrequency;
  return ({
    "a few times a month": 2,
    "1-2 times a week": 4,
    "several times a week": 7,
    daily: 10,
    "multiple times a day": 18,
  } as Record<string, number>)[frequency ?? ""] ?? 5;
}

export function buildPlayProjections(
  entries: PlanningEntry[],
  options: { now?: Date; weeklyHours: number },
) {
  const now = startOfDay(options.now ?? new Date());
  const minutesPerDay = Math.max(1, options.weeklyHours * 60 / 7);
  const projections: PlayProjection[] = [];
  const slotAvailability = new Map<number, Date>();

  const current = entries
    .filter((entry) => entry.currentPlayingSlot !== null && entry.currentPlayingSlot !== undefined)
    .sort((a, b) => (a.currentPlayingSlot ?? 0) - (b.currentPlayingSlot ?? 0));
  for (const entry of current) {
    const remaining = getRemainingMinutes(entry);
    if (remaining === null) continue;
    const finishDate = addDays(now, Math.max(1, Math.ceil(remaining / minutesPerDay)));
    const startDate = entry.manualStartedAt
      ? startOfDay(entry.manualStartedAt)
      : estimatePlayStartDate(entry.playtimeMinutes ?? 0, minutesPerDay, now);
    projections.push({ entryId: entry.id, kind: "current", startDate, finishDate, approximate: !entry.manualStartedAt });
    slotAvailability.set(entry.currentPlayingSlot!, finishDate);
  }

  const next = entries
    .filter((entry) => entry.status === "PLAYING_NEXT")
    .sort((a, b) => (a.playingNextSlot ?? 99) - (b.playingNextSlot ?? 99));
  for (const entry of next) {
    const duration = getTargetMinutes(entry.game);
    if (duration === null) continue;
    const preferredSlot = entry.playingNextSlot ?? 1;
    const earliestAvailability = slotAvailability.get(preferredSlot) ??
      [...slotAvailability.values()].sort((a, b) => a.getTime() - b.getTime())[0] ?? now;
    const release = entry.game.releaseDate ? startOfDay(entry.game.releaseDate) : null;
    const planned = entry.plannedStartDate ? startOfDay(entry.plannedStartDate) : null;
    const startDate = [earliestAvailability, release, planned]
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => b.getTime() - a.getTime())[0]!;
    const finishDate = addDays(startDate, Math.max(1, Math.ceil(duration / minutesPerDay)));
    projections.push({ entryId: entry.id, kind: "next", startDate, finishDate, approximate: true });
    slotAvailability.set(preferredSlot, finishDate);
  }
  return projections;
}

export function estimatePlayStartDate(playtimeMinutes: number, minutesPerDay: number, now = new Date()) {
  const today = startOfDay(now);
  if (playtimeMinutes <= 0) return today;
  return addDays(today, -Math.max(1, Math.ceil(playtimeMinutes / Math.max(1, minutesPerDay))));
}

export function getPlayTimeBreakdown(entry: PlanningEntry) {
  const totalMinutes = getTargetMinutes(entry.game);
  if (totalMinutes === null) return null;
  const remainingMinutes = getRemainingMinutes(entry) ?? totalMinutes;
  return {
    totalMinutes,
    remainingMinutes,
    playedMinutes: Math.max(0, totalMinutes - remainingMinutes),
  };
}

function getTargetMinutes(game: PlanningGame) {
  for (const value of [game.hltbMainExtraMinutes, game.hltbMainStoryMinutes, game.hltbCompletionistMinutes]) {
    if (value && value > 0) return value;
  }
  return null;
}

function getRemainingMinutes(entry: PlanningEntry) {
  const total = getTargetMinutes(entry.game);
  if (total === null) return null;
  if (entry.completionPercent !== null && entry.completionPercent !== undefined) {
    return Math.max(0, Math.round(total * (100 - entry.completionPercent) / 100));
  }
  return Math.max(0, total - (entry.playtimeMinutes ?? 0));
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

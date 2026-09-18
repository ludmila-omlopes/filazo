export const DAY_MS = 86_400_000;
export const OBSERVATION_DAYS = 28;

export function utcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseCalendarDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function calendarMonth(value: string | undefined, now = new Date()) {
  return parseCalendarDate(`${value}-01`) ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export type Observation = { observedAt: Date; totalMinutes: number; source: string };
export type EstimateReason = "ready" | "missing_start" | "learning" | "stale" | "inactive" | "correction" | "no_duration" | "ongoing" | "completed" | "paused" | "past_duration";
export type CalendarForecast = { estimatedFinish: Date | null; weeklyMinutes: number | null; reason: EstimateReason };

export function isCalendarEstimateCurrent(estimate: { calculatedAt: Date; estimatedFinish: Date | null }, now = new Date()) {
  return now.getTime() - estimate.calculatedAt.getTime() <= 2 * DAY_MS &&
    (!estimate.estimatedFinish || estimate.estimatedFinish >= utcDay(now));
}

// The rate belongs to THIS game. Idle days stay in the denominator; no assumed
// weekly budget or achievement percentage is used as a proxy for play time.
export function estimateCalendarFinish(input: {
  start: Date | null;
  finished: boolean;
  paused: boolean;
  ongoing: boolean;
  targetMinutes: number | null;
  totalMinutes: number | null;
  observations: Observation[];
  now?: Date;
}): CalendarForecast {
  const now = input.now ?? new Date();
  const unavailable = (reason: EstimateReason): CalendarForecast => ({ estimatedFinish: null, weeklyMinutes: null, reason });
  if (input.finished) return unavailable("completed");
  if (input.paused) return unavailable("paused");
  if (input.ongoing) return unavailable("ongoing");
  if (!input.start || input.start > now) return unavailable("missing_start");
  if (!input.targetMinutes || input.targetMinutes <= 0) return unavailable("no_duration");
  const samples = input.observations.filter((sample) =>
    sample.observedAt >= input.start! && sample.observedAt <= now &&
    sample.observedAt.getTime() >= now.getTime() - OBSERVATION_DAYS * DAY_MS &&
    Number.isFinite(sample.totalMinutes) && sample.totalMinutes >= 0,
  ).sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
  if (samples.length < 2) return unavailable("learning");
  const last = samples[samples.length - 1];
  // A provider that has not synced recently cannot establish a current pace.
  if (last.source !== "calendar" && now.getTime() - last.observedAt.getTime() > 3 * DAY_MS) return unavailable("stale");
  let baseline = 0;
  let corrected = false;
  for (let i = 1; i < samples.length; i++) {
    const elapsed = (samples[i].observedAt.getTime() - samples[i - 1].observedAt.getTime()) / DAY_MS;
    const delta = samples[i].totalMinutes - samples[i - 1].totalMinutes;
    if (delta < 0 || delta > Math.max(1, elapsed) * 16 * 60 || samples[i].source !== samples[i - 1].source) {
      baseline = i;
      corrected = true;
    }
  }
  const first = samples[baseline];
  const spanDays = (now.getTime() - first.observedAt.getTime()) / DAY_MS;
  if (spanDays < 7 || samples.length - baseline < 2) return unavailable(corrected ? "correction" : "learning");
  const gains = samples.slice(baseline + 1).filter((sample, i) => sample.totalMinutes > samples[baseline + i].totalMinutes);
  const recentGain = gains.at(-1);
  if (!recentGain || now.getTime() - recentGain.observedAt.getTime() >= 7 * DAY_MS) return unavailable("inactive");
  // Never mark a game complete simply because it exceeded an average duration.
  const remaining = input.targetMinutes - (input.totalMinutes ?? last.totalMinutes);
  if (remaining <= 0) return unavailable("past_duration");
  const dailyMinutes = (last.totalMinutes - first.totalMinutes) / spanDays;
  const daysToFinish = Math.ceil(remaining * spanDays / (last.totalMinutes - first.totalMinutes));
  if (!Number.isFinite(daysToFinish) || daysToFinish > 3650) return unavailable("inactive");
  return {
    reason: "ready",
    weeklyMinutes: dailyMinutes * 7,
    estimatedFinish: new Date(utcDay(now).getTime() + Math.max(1, daysToFinish) * DAY_MS),
  };
}

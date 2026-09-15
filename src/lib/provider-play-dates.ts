import { parseCalendarDate, utcDay } from "./calendar-policy.ts";

export type ProviderPlayDate = { provider: "STEAM" | "PLAYSTATION" | "XBOX"; day: Date; kind: "first_played" | "played" };
export type GamePlayDate = ProviderPlayDate & { gameId: string };
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function validDate(value: unknown, now: Date): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !parseCalendarDate(value.slice(0, 10))) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() > 0 && date <= now ? date : null;
}

// Read only fields supplied by a play-history endpoint, never purchase dates,
// trophy timestamps, catalog metadata, or the date an import ran.
export function providerPlayDates(provider: string | null, rawData: unknown, now = new Date()): ProviderPlayDate[] {
  const raw = record(rawData);
  const result: ProviderPlayDate[] = [];
  if (provider === "STEAM") {
    const seconds = raw.rtimeLastPlayed;
    if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 && seconds <= now.getTime() / 1000) result.push({ provider, day: utcDay(new Date(seconds * 1000)), kind: "played" });
  }
  if (provider === "PLAYSTATION") {
    const sources = Array.isArray(raw.playStationSyncSources) ? raw.playStationSyncSources : [raw];
    for (const source of sources) {
      const item = record(source);
      if (item.syncSource !== "played-game") continue;
      const first = validDate(item.firstPlayedDateTime, now);
      const last = validDate(item.lastPlayedDateTime, now);
      if (first && (!last || first <= last)) result.push({ provider, day: utcDay(first), kind: "first_played" });
      if (last) result.push({ provider, day: utcDay(last), kind: "played" });
    }
  }
  if (provider === "XBOX") {
    const hub = raw.syncSource === "xbox-titlehub-history" ? raw : record(raw.titleHubTitle);
    const last = validDate(record(record(hub.title).titleHistory).lastTimePlayed, now);
    if (last) result.push({ provider, day: utcDay(last), kind: "played" });
  }
  return [...new Map(result.map(item => [`${item.kind}:${item.day.toISOString()}`, item])).values()];
}

export function collectGamePlayDates(entries: { gameId: string; provider: string | null; rawData: unknown }[], stored: { gameId: string; provider: string; day: Date; kind: string }[], now = new Date()): GamePlayDate[] {
  const dates = entries.flatMap(entry => providerPlayDates(entry.provider, entry.rawData, now).map(item => ({ ...item, gameId: entry.gameId })));
  for (const item of stored) {
    if (["STEAM", "PLAYSTATION", "XBOX"].includes(item.provider) && ["first_played", "played"].includes(item.kind) && item.day <= now) dates.push(item as GamePlayDate);
  }
  return [...new Map(dates.map(item => [`${item.gameId}:${item.provider}:${item.kind}:${item.day.toISOString()}`, item])).values()];
}

export function calendarStartForGame(entry: { gameId: string; manualStartedAt: Date | null; finishedAt?: Date | null }, dates: GamePlayDate[], relatedEntries: { gameId: string; manualStartedAt: Date | null }[] = []) {
  const manual = entry.manualStartedAt ?? relatedEntries.find(item => item.gameId === entry.gameId && item.manualStartedAt)?.manualStartedAt;
  if (manual) return { date: manual, provider: null };
  const first = dates.filter(item => item.gameId === entry.gameId && item.kind === "first_played" && (!entry.finishedAt || item.day <= entry.finishedAt)).sort((a, b) => a.day.getTime() - b.day.getTime())[0];
  return { date: first?.day ?? null, provider: first?.provider ?? null };
}

export const playDateProviderName = (provider: string) => ({ STEAM: "Steam", PLAYSTATION: "PlayStation", XBOX: "Xbox" })[provider] ?? provider;

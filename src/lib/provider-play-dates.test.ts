import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarStartForGame, collectGamePlayDates, providerPlayDates } from "./provider-play-dates.ts";

const now = new Date("2026-09-15T12:00:00Z");
const psn = { playStationSyncSources: [
  { syncSource: "purchased-game", firstPlayedDateTime: "2026-01-01T00:00:00Z" },
  { syncSource: "trophy-title", lastUpdatedDateTime: "2026-09-15T00:00:00Z" },
  { syncSource: "played-game", firstPlayedDateTime: "2026-08-03T23:00:00Z", lastPlayedDateTime: "2026-09-14T01:00:00Z" },
] };

test("PSN supplies only first/last play dates, never purchase/trophy dates or intermediate days", () => {
  const dates = providerPlayDates("PLAYSTATION", psn, now);
  assert.deepEqual(dates.map(item => [item.kind, item.day.toISOString().slice(0, 10)]), [["first_played", "2026-08-03"], ["played", "2026-09-14"]]);
  assert.equal(providerPlayDates("STEAM", psn, now).length, 0);
});

test("Steam last played is activity, never an invented start date", () => {
  const dates = providerPlayDates("STEAM", { rtimeLastPlayed: Date.parse("2026-09-13T18:00:00Z") / 1000 }, now);
  assert.equal(dates[0].kind, "played");
  assert.equal(calendarStartForGame({ gameId: "g", manualStartedAt: null }, dates.map(item => ({ ...item, gameId: "g" }))).date, null);
  assert.equal(providerPlayDates("STEAM", { rtimeLastPlayed: 0 }, now).length, 0);
});

test("Xbox reads the nested title-hub time and rejects achievement-only timestamps", () => {
  const titleHubTitle = { syncSource: "xbox-titlehub-history", title: { titleHistory: { lastTimePlayed: "2026-09-10T23:30:00Z" } } };
  const raw = { syncSource: "xbox-achievement-title-history", achievementTitle: { lastUnlock: "2026-09-14T00:00:00Z" }, titleHubTitle };
  assert.equal(providerPlayDates("XBOX", raw, now)[0].day.toISOString().slice(0, 10), "2026-09-10");
  assert.equal(providerPlayDates("XBOX", { ...raw, titleHubTitle: null }, now).length, 0);
});

test("invalid, future, sentinel and inverted provider dates are excluded", () => {
  for (const value of ["2026-02-30T12:00:00Z", "invalid", "1970-01-01T00:00:00Z", "2027-01-01T00:00:00Z"]) assert.equal(providerPlayDates("PLAYSTATION", { syncSource: "played-game", firstPlayedDateTime: value, lastPlayedDateTime: value }, now).length, 0);
  assert.deepEqual(providerPlayDates("PLAYSTATION", { syncSource: "played-game", firstPlayedDateTime: "2026-09-14T00:00:00Z", lastPlayedDateTime: "2026-08-01T00:00:00Z" }, now).map(item => item.kind), ["played"]);
});

test("persisted activities survive newer snapshots, deduplicate related entries, and respect manual starts", () => {
  const entries = [{ gameId: "g", provider: "PLAYSTATION", rawData: psn }];
  const old = { gameId: "g", provider: "PLAYSTATION", day: new Date("2026-09-01"), kind: "played" };
  const dates = collectGamePlayDates([...entries, ...entries], [old, old], now);
  assert.equal(dates.length, 3);
  assert.equal(calendarStartForGame({ gameId: "g", manualStartedAt: null }, dates).date?.toISOString().slice(0, 10), "2026-08-03");
  const manual = new Date("2026-09-12");
  assert.deepEqual(calendarStartForGame({ gameId: "g", manualStartedAt: manual }, dates), { date: manual, provider: null });
  assert.deepEqual(calendarStartForGame({ gameId: "g", manualStartedAt: null }, dates, [{ gameId: "g", manualStartedAt: manual }]), { date: manual, provider: null });
  assert.equal(calendarStartForGame({ gameId: "other", manualStartedAt: null }, dates).date, null);
});

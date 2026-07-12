import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPlayProjections, estimatePlayStartDate, getBacklogEstimate, getPlayTimeBreakdown, weeklyHoursFromOnboarding } from "./play-planning.ts";

const game = (minutes: number | null, releaseDate: Date | null = null) => ({
  name: "Game",
  releaseDate,
  hltbMainStoryMinutes: minutes,
});

test("backlog estimate only includes untouched, active backlog entries", () => {
  const result = getBacklogEstimate([
    { id: "included", status: "BACKLOG", game: game(600) },
    { id: "owned-active", status: "OWNED", activeBacklog: true, game: game(300) },
    { id: "missing", status: "BACKLOG", game: game(null) },
    { id: "played", status: "BACKLOG", playtimeMinutes: 10, game: game(300) },
    { id: "dropped", status: "BACKLOG", abandonedAt: new Date(), game: game(300) },
    { id: "inactive", status: "OWNED", activeBacklog: false, game: game(300) },
    { id: "current", status: "PLAYING", currentPlayingSlot: 1, playtimeMinutes: 100, game: game(400) },
    { id: "completed", status: "COMPLETED", currentPlayingSlot: 2, game: game(900) },
    { id: "abandoned", status: "PLAYING", currentPlayingSlot: 3, abandonedAt: new Date(), game: game(900) },
  ]);
  assert.deepEqual(result, { minutes: 1200, gamesWithEstimate: 3, eligibleGames: 4, isPartial: true });
});

test("weekly hours uses onboarding rhythm and a documented fallback", () => {
  assert.equal(weeklyHoursFromOnboarding({ playFrequency: "daily" }), 10);
  assert.equal(weeklyHoursFromOnboarding(null), 5);
});

test("playing next begins after its slot opens and never before release", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const projections = buildPlayProjections([
    { id: "current", status: "PLAYING", currentPlayingSlot: 1, game: game(420) },
    { id: "next", status: "PLAYING_NEXT", playingNextSlot: 1, game: game(420, new Date("2026-01-20T00:00:00Z")) },
  ], { now, weeklyHours: 7 });
  assert.equal(projections[0]?.finishDate.toISOString().slice(0, 10), "2026-01-08");
  assert.equal(projections[1]?.startDate.toISOString().slice(0, 10), "2026-01-20");
  assert.equal(projections[1]?.finishDate.toISOString().slice(0, 10), "2026-01-27");
});

test("playing next honors a later date chosen by the user", () => {
  const projections = buildPlayProjections([
    { id: "next", status: "PLAYING_NEXT", playingNextSlot: 1, plannedStartDate: new Date("2026-02-10T00:00:00Z"), game: game(420) },
  ], { now: new Date("2026-01-01T00:00:00Z"), weeklyHours: 7 });
  assert.equal(projections[0]?.startDate.toISOString().slice(0, 10), "2026-02-10");
  assert.equal(projections[0]?.approximate, false);
});

test("playing next uses the user's planned date instead of replacing it with slot availability", () => {
  const projections = buildPlayProjections([
    { id: "current", status: "PLAYING", currentPlayingSlot: 1, game: game(420) },
    { id: "next", status: "PLAYING_NEXT", playingNextSlot: 1, plannedStartDate: new Date("2026-01-03T00:00:00Z"), game: game(420) },
  ], { now: new Date("2026-01-01T00:00:00Z"), weeklyHours: 7 });
  assert.equal(projections[1]?.startDate.toISOString().slice(0, 10), "2026-01-03");
  assert.equal(projections[1]?.approximate, false);
});

test("current game start is inferred backwards from time already played", () => {
  assert.equal(estimatePlayStartDate(72 * 60, 60, new Date("2026-07-12T12:00:00Z")).toISOString().slice(0, 10), "2026-05-01");
});

test("manual current-game start date overrides inference", () => {
  const projections = buildPlayProjections([
    { id: "current", status: "PLAYING", currentPlayingSlot: 1, playtimeMinutes: 72 * 60, manualStartedAt: new Date("2026-03-10T00:00:00Z"), game: game(6000) },
  ], { now: new Date("2026-07-12T00:00:00Z"), weeklyHours: 7 });
  assert.equal(projections[0]?.startDate.toISOString().slice(0, 10), "2026-03-10");
  assert.equal(projections[0]?.approximate, false);
});

test("calendar playtime uses recorded minutes instead of achievement progress", () => {
  const breakdown = getPlayTimeBreakdown({
    id: "clair-obscur",
    status: "PLAYING",
    playtimeMinutes: 4407,
    completionPercent: 32,
    game: {
      name: "Clair Obscur: Expedition 33",
      hltbMainExtraMinutes: 2745,
    },
  });

  assert.deepEqual(breakdown, {
    totalMinutes: 4407,
    playedMinutes: 4407,
    remainingMinutes: 0,
  });
});

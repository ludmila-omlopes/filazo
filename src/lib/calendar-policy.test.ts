import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarMonth, estimateCalendarFinish, isCalendarEstimateCurrent, parseCalendarDate } from "./calendar-policy.ts";

const now = new Date("2026-09-15T12:00:00Z");
const base = {
  start: new Date("2026-09-01T00:00:00Z"), now,
  finished: false, paused: false, ongoing: false, targetMinutes: 1200, totalMinutes: 600,
  observations: [
    { observedAt: new Date("2026-09-01T12:00:00Z"), totalMinutes: 0, source: "STEAM" },
    { observedAt: new Date("2026-09-08T12:00:00Z"), totalMinutes: 300, source: "STEAM" },
    { observedAt: now, totalMinutes: 600, source: "STEAM" },
  ],
};

test("uses the game's observed pace and retains idle days, not onboarding", () => {
  const result = estimateCalendarFinish(base);
  assert.equal(result.reason, "ready");
  assert.equal(result.weeklyMinutes, 300);
  assert.equal(result.estimatedFinish?.toISOString(), "2026-09-29T00:00:00.000Z");
  const slower = estimateCalendarFinish({ ...base, totalMinutes: 300, observations: base.observations.map((s) => ({ ...s, totalMinutes: s.totalMinutes / 2 })) });
  assert.equal(slower.weeklyMinutes, 150);
  assert.ok(slower.estimatedFinish! > result.estimatedFinish!);
});

test("never invents an actual start or extrapolates from first imported lifetime hours", () => {
  assert.equal(estimateCalendarFinish({ ...base, start: null }).reason, "missing_start");
  assert.equal(estimateCalendarFinish({ ...base, observations: [base.observations[2]] }).reason, "learning");
  const imported = estimateCalendarFinish({ ...base, targetMinutes: 3000, totalMinutes: 2400, observations: base.observations.map((s) => ({ ...s, totalMinutes: s.totalMinutes + 1800 })) });
  assert.equal(imported.weeklyMinutes, 300);
});

test("stale sources and inactivity suppress dates instead of pushing them forever", () => {
  assert.equal(estimateCalendarFinish({ ...base, now: new Date("2026-09-19T12:00:00Z") }).reason, "stale");
  const inactive = estimateCalendarFinish({ ...base, observations: base.observations.map((s) => ({ ...s, totalMinutes: 600 })) });
  assert.equal(inactive.reason, "inactive");
  assert.equal(inactive.estimatedFinish, null);
});

test("counter corrections, source changes and impossible gains restart observation", () => {
  for (const sample of [
    { ...base.observations[2], totalMinutes: 10 },
    { ...base.observations[2], source: "calendar" },
    { ...base.observations[2], totalMinutes: 100000 },
  ]) assert.equal(estimateCalendarFinish({ ...base, observations: [...base.observations.slice(0, 2), sample] }).reason, "correction");
});

test("completion, pause, ongoing games, unknown duration and exceeded averages never invent finish dates", () => {
  for (const [override, reason] of [
    [{ finished: true }, "completed"], [{ paused: true }, "paused"], [{ ongoing: true }, "ongoing"],
    [{ targetMinutes: null }, "no_duration"], [{ totalMinutes: 1200 }, "past_duration"],
  ] as const) {
    const result = estimateCalendarFinish({ ...base, ...override });
    assert.equal(result.reason, reason);
    assert.equal(result.estimatedFinish, null);
  }
});

test("rejects impossible dates and months instead of silently normalizing them", () => {
  assert.equal(parseCalendarDate("2026-02-30"), null);
  assert.equal(parseCalendarDate("2026-13-01"), null);
  assert.equal(parseCalendarDate("2024-02-29")?.toISOString().slice(0, 10), "2024-02-29");
  assert.equal(calendarMonth("2026-99", now).toISOString().slice(0, 10), "2026-09-01");
});

test("old stored forecasts and expired predicted dates are not presented as current", () => {
  assert.equal(isCalendarEstimateCurrent({ calculatedAt: now, estimatedFinish: new Date("2026-09-29") }, now), true);
  assert.equal(isCalendarEstimateCurrent({ calculatedAt: new Date("2026-09-01"), estimatedFinish: new Date("2026-09-29") }, now), false);
  assert.equal(isCalendarEstimateCurrent({ calculatedAt: now, estimatedFinish: new Date("2026-09-14") }, now), false);
});

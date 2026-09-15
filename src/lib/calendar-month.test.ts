import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarMonthDays, eventsInCalendarMonth, shiftCalendarMonth } from "./calendar-month.ts";

test("calendar aligns weekdays and includes complete weeks across year boundaries", () => {
  const days = calendarMonthDays("2026-08");
  assert.equal(days.length, 42);
  assert.equal(days[0].date, "2026-07-26");
  assert.equal(days[6].date, "2026-08-01");
  assert.equal(days.filter(day => day.inMonth).length, 31);
  assert.equal(new Set(days.map(day => day.date)).size, days.length);
  assert.equal(shiftCalendarMonth("2026-12", 1), "2027-01");
  assert.equal(shiftCalendarMonth("2026-01", -1), "2025-12");
});

test("calendar handles leap days and four-week February without fabricated dates", () => {
  assert.equal(calendarMonthDays("2024-02").filter(day => day.inMonth).length, 29);
  assert.equal(calendarMonthDays("2026-02").length, 28);
  assert.equal(calendarMonthDays("2026-02").at(-1)?.date, "2026-02-28");
});

test("month list preserves every event on a busy date and excludes adjacent months", () => {
  const events = ["2026-09-30", "2026-10-01", "2026-09-01", "2026-09-01"].map((date, index) => ({ id: String(index), date, title: "Game", kind: "release" as const }));
  assert.deepEqual(eventsInCalendarMonth(events, "2026-09").map(event => event.id), ["2", "3", "0"]);
  assert.equal(events[0].date, "2026-09-30");
});

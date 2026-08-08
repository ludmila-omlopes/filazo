import assert from "node:assert/strict";
import test from "node:test";
import {
  BETA_ACTIVE_WINDOW_DAYS,
  isBetaTesterActive,
  latestDate,
} from "./beta-activity.ts";

test("latestDate returns the newest valid activity signal", () => {
  const oldest = new Date("2026-01-01T00:00:00.000Z");
  const newest = new Date("2026-02-01T00:00:00.000Z");

  assert.equal(latestDate([oldest, null, newest, undefined]), newest);
  assert.equal(latestDate([null, undefined]), null);
});

test(`a beta tester is active when the latest signal is within ${BETA_ACTIVE_WINDOW_DAYS} days`, () => {
  const now = new Date("2026-08-07T12:00:00.000Z");

  assert.equal(isBetaTesterActive(new Date("2026-07-08T12:00:00.000Z"), now), true);
  assert.equal(isBetaTesterActive(new Date("2026-07-08T11:59:59.999Z"), now), false);
  assert.equal(isBetaTesterActive(null, now), false);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getSyncedEntryProgressData,
  getSyncedPlaytimeData,
} from "./playtime-conflict.ts";

test("sync keeps a manual value and creates a pending replacement", () => {
  const result = getSyncedPlaytimeData({ playtimeMinutes: 120, playtimeSource: "manual" }, 180);
  assert.equal(result.pendingPlaytimeMinutes, 180);
  assert.ok(result.pendingPlaytimeSyncedAt instanceof Date);
  assert.equal("playtimeMinutes" in result, false);
});

test("sync updates non-manual values directly", () => {
  assert.deepEqual(getSyncedPlaytimeData({ playtimeMinutes: 120, playtimeSource: "sync" }, 180), {
    playtimeMinutes: 180,
    playtimeSource: "sync",
    pendingPlaytimeMinutes: null,
    pendingPlaytimeSyncedAt: null,
  });
});

test("sync updates provider progress while preserving a manual playtime", () => {
  const lastPlayedAt = new Date("2026-07-10T00:26:39.950Z");
  const result = getSyncedEntryProgressData(
    { playtimeMinutes: 4200, playtimeSource: "manual" },
    {
      completionPercent: 51,
      lastPlayedAt,
      playtimeMinutes: 4407,
    },
  );

  assert.equal(result.completionPercent, 51);
  assert.equal(result.lastPlayedAt, lastPlayedAt);
  assert.equal(result.pendingPlaytimeMinutes, 4407);
  assert.equal("playtimeMinutes" in result, false);
});

test("sync leaves unavailable provider progress unchanged", () => {
  assert.deepEqual(
    getSyncedEntryProgressData(
      { playtimeMinutes: 120, playtimeSource: "sync" },
      {
        completionPercent: null,
        lastPlayedAt: null,
        playtimeMinutes: null,
      },
    ),
    {},
  );
});

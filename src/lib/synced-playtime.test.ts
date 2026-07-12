import assert from "node:assert/strict";
import { test } from "node:test";
import { getSyncedPlaytimeData } from "./playtime-conflict.ts";

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

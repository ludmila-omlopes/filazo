import assert from "node:assert/strict";
import { test } from "node:test";
import { getSyncHealth, getSyncIncidentKey, SYNC_STALL_MS, type SyncHealthRun } from "./sync-incident-policy.ts";

const now = new Date("2026-09-10T15:00:00Z");
const base: SyncHealthRun = {
  id: "run", provider: "STEAM", externalAccountId: "account", workerScope: "production",
  status: "RUNNING", errorCode: null, lastProgressAt: null,
  startedAt: new Date(now.getTime() - SYNC_STALL_MS), createdAt: new Date(now.getTime() - SYNC_STALL_MS),
  nextAttemptAt: new Date(now.getTime() - SYNC_STALL_MS),
};

test("monitor ignores local, preview and skipped runs", () => {
  assert.equal(getSyncHealth({ ...base, workerScope: "development", status: "FAILED" }, now), null);
  assert.equal(getSyncHealth({ ...base, workerScope: "preview", status: "FAILED" }, now), null);
  assert.equal(getSyncHealth({ ...base, status: "SKIPPED" }, now), null);
});

test("a long import advancing recently is healthy; rescheduling without progress is stalled", () => {
  assert.equal(getSyncHealth({ ...base, lastProgressAt: now }, now), "RETRYING");
  assert.equal(getSyncHealth({ ...base, nextAttemptAt: now }, now), "STALLED");
  assert.equal(getSyncHealth({ ...base, status: "PENDING" }, now), "STALLED");
});

test("intentional rate-limit backoff is not stalled", () => {
  assert.equal(getSyncHealth({ ...base, status: "PENDING", errorCode: "RATE_LIMIT", nextAttemptAt: new Date(now.getTime() + 60_000) }, now), "RETRYING");
  assert.equal(getSyncHealth({ ...base, status: "FAILED" }, now), "FAILED");
  assert.equal(getSyncHealth({ ...base, status: "SUCCEEDED" }, now), "RECOVERED");
});

test("Steam shared credentials group users; individual provider authorization stays separate", () => {
  assert.equal(getSyncIncidentKey({ ...base, errorCode: "CONFIGURATION" }), getSyncIncidentKey({ ...base, errorCode: "AUTH", externalAccountId: "other" }));
  assert.notEqual(getSyncIncidentKey({ ...base, provider: "XBOX", errorCode: "AUTH" }), getSyncIncidentKey({ ...base, provider: "XBOX", errorCode: "AUTH", externalAccountId: "other" }));
});

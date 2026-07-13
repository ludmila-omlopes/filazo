import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PLATFORM_SYNC_INTERVAL_MS,
  PLATFORM_SYNC_MANUAL_COOLDOWN_MS,
  PLATFORM_SYNC_MAX_BACKOFF_MS,
  classifyPlatformSyncError,
  getNextAutomaticSyncAt,
  getRetryDelayMs,
  isAccountDueForScheduledSync,
  isManualSyncInCooldown,
  sanitizePlatformSyncError,
} from "./platform-sync-policy.ts";

const NOW = new Date("2026-07-13T12:00:00.000Z");

test("scheduled eligibility respects nextSyncAt and the 24-hour window", () => {
  assert.equal(
    isAccountDueForScheduledSync(
      { createdAt: NOW, lastSyncedAt: null, nextSyncAt: null },
      NOW,
    ),
    true,
  );
  assert.equal(
    isAccountDueForScheduledSync(
      {
        createdAt: new Date(NOW.getTime() - PLATFORM_SYNC_INTERVAL_MS * 2),
        lastSyncedAt: new Date(NOW.getTime() - PLATFORM_SYNC_INTERVAL_MS + 1),
        nextSyncAt: null,
      },
      NOW,
    ),
    false,
  );
  assert.equal(
    isAccountDueForScheduledSync(
      {
        createdAt: new Date(NOW.getTime() - PLATFORM_SYNC_INTERVAL_MS * 2),
        lastSyncedAt: new Date(NOW.getTime() - PLATFORM_SYNC_INTERVAL_MS),
        nextSyncAt: null,
      },
      NOW,
    ),
    true,
  );
  assert.equal(
    isAccountDueForScheduledSync(
      {
        createdAt: new Date(NOW.getTime() - PLATFORM_SYNC_INTERVAL_MS * 3),
        lastSyncedAt: new Date(NOW.getTime() - PLATFORM_SYNC_INTERVAL_MS * 2),
        nextSyncAt: new Date(NOW.getTime() + 1),
      },
      NOW,
    ),
    false,
  );
});

test("manual cooldown applies only for five minutes after an attempt", () => {
  assert.equal(
    isManualSyncInCooldown(
      new Date(NOW.getTime() - PLATFORM_SYNC_MANUAL_COOLDOWN_MS + 1),
      NOW,
    ),
    true,
  );
  assert.equal(
    isManualSyncInCooldown(
      new Date(NOW.getTime() - PLATFORM_SYNC_MANUAL_COOLDOWN_MS),
      NOW,
    ),
    false,
  );
});

test("next automatic sync is never before 24 hours and includes bounded jitter", () => {
  assert.equal(
    getNextAutomaticSyncAt(NOW, 60_000, () => 0).toISOString(),
    new Date(NOW.getTime() + PLATFORM_SYNC_INTERVAL_MS).toISOString(),
  );
  assert.equal(
    getNextAutomaticSyncAt(NOW, 60_000, () => 1).toISOString(),
    new Date(NOW.getTime() + PLATFORM_SYNC_INTERVAL_MS + 60_000).toISOString(),
  );
});

test("retry policy backs off transient failures and pauses auth/configuration failures", () => {
  assert.equal(
    getRetryDelayMs({
      errorCode: "RATE_LIMIT",
      failureCount: 1,
      random: () => 0,
    }),
    15 * 60 * 1000,
  );
  assert.equal(
    getRetryDelayMs({
      errorCode: "RATE_LIMIT",
      failureCount: 2,
      retryAfterMs: 2 * 60 * 60 * 1000,
      random: () => 0,
    }),
    2 * 60 * 60 * 1000,
  );
  assert.equal(
    getRetryDelayMs({
      errorCode: "AUTH",
      failureCount: 1,
      random: () => 0,
    }),
    PLATFORM_SYNC_MAX_BACKOFF_MS,
  );
});

test("error sanitization removes tokens before a run can persist them", () => {
  const message = sanitizePlatformSyncError(
    new Error('Request failed: Bearer abc.def-123 access_token="top-secret"'),
  );

  assert.match(message, /\[redacted\]/);
  assert.doesNotMatch(message, /abc\.def-123|top-secret/);
  assert.equal(
    classifyPlatformSyncError(new Error("Request failed (429)")).code,
    "RATE_LIMIT",
  );
  const rateLimited = Object.assign(new Error("Request failed (429)"), {
    retryAfter: "120",
  });
  assert.equal(
    classifyPlatformSyncError(rateLimited).retryAfterMs,
    120_000,
  );
});

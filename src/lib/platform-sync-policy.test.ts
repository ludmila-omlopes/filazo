import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PLATFORM_SYNC_INTERVAL_MS,
  PLATFORM_SYNC_MAX_BACKOFF_MS,
  classifyPlatformSyncError,
  getNextAutomaticSyncAt,
  getRetryDelayMs,
  isAccountDueForScheduledSync,
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

test("classifies platform sync failures by code", () => {
  const cases = [
    ["Request timed out", "TIMEOUT"],
    ["HTTP 429 rate limit", "RATE_LIMIT"],
    ["Steam API key is required to sync owned games.", "CONFIGURATION"],
    ["Could not fetch Steam profile (401).", "AUTH"],
    ["fetch failed", "NETWORK"],
    ["Could not load owned games from Steam (503).", "PROVIDER"],
    ["something odd", "INTERNAL"],
  ] as const;

  for (const [message, code] of cases) {
    assert.equal(classifyPlatformSyncError(new Error(message)).code, code);
  }
});

test("characterizes classifier keyword precedence", () => {
  // characterization: the literal environment variable name does not match
  // the spaced "api key is required" configuration keyword.
  assert.equal(
    classifyPlatformSyncError(
      new Error("STEAM_API_KEY is required to sync owned games from Steam."),
    ).code,
    "INTERNAL",
  );
  // characterization: "fetch" is checked before the generic HTTP status
  // branch, so a provider 503 with that verb is currently a network error.
  assert.equal(
    classifyPlatformSyncError(
      new Error("Could not fetch owned games from Steam (503)."),
    ).code,
    "NETWORK",
  );
});

test("extracts retry-after delays from error metadata and messages", () => {
  const fromMetadata = Object.assign(new Error("HTTP 429"), {
    retryAfter: "120",
  });
  assert.equal(classifyPlatformSyncError(fromMetadata).retryAfterMs, 120_000);
  assert.equal(
    classifyPlatformSyncError(new Error("retry-after: 30 seconds")).retryAfterMs,
    30_000,
  );
  assert.equal(classifyPlatformSyncError(new Error("no retry hint")).retryAfterMs, null);
});

test("sanitizes URLs and secrets and caps persisted messages", () => {
  const message = sanitizePlatformSyncError(
    new Error(
      `client_secret=SHOULD_NOT_APPEAR https://example.test/path?api_key=SHOULD_NOT_APPEAR ${"x".repeat(400)}`,
    ),
  );

  assert.match(message, /\[redacted\]/);
  assert.match(message, /\[url\]/);
  assert.doesNotMatch(message, /SHOULD_NOT_APPEAR|example\.test/);
  assert.equal(message.length, 280);
});

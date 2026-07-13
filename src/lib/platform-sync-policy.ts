export const PLATFORM_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const PLATFORM_SYNC_MANUAL_COOLDOWN_MS = 5 * 60 * 1000;
export const PLATFORM_SYNC_DEFAULT_JITTER_MS = 90 * 60 * 1000;
export const PLATFORM_SYNC_MAX_BACKOFF_MS = 7 * 24 * 60 * 60 * 1000;

export type PlatformSyncErrorCode =
  | "ACCOUNT_MISSING"
  | "AUTH"
  | "CONFIGURATION"
  | "INTERNAL"
  | "NETWORK"
  | "PROVIDER"
  | "RATE_LIMIT"
  | "TIMEOUT";

type AccountSchedule = {
  createdAt: Date;
  lastSyncedAt: Date | null;
  nextSyncAt: Date | null;
};

function clampInteger(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max
    ? parsed
    : fallback;
}

function isEnabled(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === "true";
}

export function getPlatformSyncPolicy(env = process.env) {
  const jitterMinutes = clampInteger(
    env.PLATFORM_SYNC_JITTER_MINUTES,
    PLATFORM_SYNC_DEFAULT_JITTER_MS / 60_000,
    12 * 60,
  );

  return {
    accountTimeoutMs: clampInteger(
      env.PLATFORM_SYNC_ACCOUNT_TIMEOUT_MS,
      45_000,
      5 * 60_000,
    ),
    batchSize: clampInteger(env.PLATFORM_SYNC_BATCH_SIZE, 6, 50),
    enabled: isEnabled(env.PLATFORM_SYNC_ENABLED),
    jitterMs: jitterMinutes * 60_000,
    maxConcurrency: clampInteger(
      env.PLATFORM_SYNC_MAX_CONCURRENCY,
      2,
      6,
    ),
    runBudgetMs: clampInteger(
      env.PLATFORM_SYNC_RUN_BUDGET_MS,
      90_000,
      10 * 60_000,
    ),
    schedulerRateLimitMs: clampInteger(
      env.PLATFORM_SYNC_SCHEDULER_RATE_LIMIT_SECONDS,
      60,
      60 * 60,
    ) * 1000,
    steamEnabled: isEnabled(env.PLATFORM_SYNC_STEAM_ENABLED, true),
    playStationEnabled: isEnabled(
      env.PLATFORM_SYNC_PLAYSTATION_ENABLED,
      true,
    ),
    xboxEnabled: isEnabled(env.PLATFORM_SYNC_XBOX_ENABLED, true),
  };
}

export function isAccountDueForScheduledSync(
  account: AccountSchedule,
  now = new Date(),
) {
  if (account.nextSyncAt) {
    return account.nextSyncAt.getTime() <= now.getTime();
  }

  if (!account.lastSyncedAt) return true;
  return account.lastSyncedAt.getTime() + PLATFORM_SYNC_INTERVAL_MS <= now.getTime();
}

export function isManualSyncInCooldown(
  lastSyncAttemptAt: Date | null,
  now = new Date(),
) {
  return Boolean(
    lastSyncAttemptAt &&
      lastSyncAttemptAt.getTime() + PLATFORM_SYNC_MANUAL_COOLDOWN_MS >
        now.getTime(),
  );
}

export function getNextAutomaticSyncAt(
  now = new Date(),
  jitterMs = PLATFORM_SYNC_DEFAULT_JITTER_MS,
  random = Math.random,
) {
  const jitter = Math.floor(Math.max(0, jitterMs) * Math.min(1, Math.max(0, random())));
  return new Date(now.getTime() + PLATFORM_SYNC_INTERVAL_MS + jitter);
}

export function getRetryDelayMs({
  errorCode,
  failureCount,
  retryAfterMs,
  random = Math.random,
}: {
  errorCode: PlatformSyncErrorCode;
  failureCount: number;
  retryAfterMs?: number | null;
  random?: () => number;
}) {
  if (errorCode === "ACCOUNT_MISSING") return PLATFORM_SYNC_MAX_BACKOFF_MS;
  if (errorCode === "AUTH" || errorCode === "CONFIGURATION") {
    return PLATFORM_SYNC_MAX_BACKOFF_MS;
  }

  const baseMs =
    errorCode === "INTERNAL" || errorCode === "PROVIDER"
      ? 60 * 60 * 1000
      : 15 * 60 * 1000;
  const exponentialMs = baseMs * 2 ** Math.min(Math.max(failureCount - 1, 0), 6);
  const requestedRetryMs = Math.max(0, retryAfterMs ?? 0);
  const cappedMs = Math.min(
    PLATFORM_SYNC_MAX_BACKOFF_MS,
    Math.max(exponentialMs, requestedRetryMs),
  );
  const jitterMs = Math.floor(cappedMs * 0.2 * Math.min(1, Math.max(0, random())));

  return Math.min(PLATFORM_SYNC_MAX_BACKOFF_MS, cappedMs + jitterMs);
}

export function classifyPlatformSyncError(error: unknown): {
  code: PlatformSyncErrorCode;
  message: string;
  retryAfterMs: number | null;
} {
  const message = sanitizePlatformSyncError(error);
  const normalized = message.toLowerCase();

  let code: PlatformSyncErrorCode = "INTERNAL";
  if (
    normalized.includes("abort") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout")
  ) {
    code = "TIMEOUT";
  } else if (normalized.includes("429") || normalized.includes("rate limit")) {
    code = "RATE_LIMIT";
  } else if (
    normalized.includes("api key is required") ||
    normalized.includes("client_id") ||
    normalized.includes("client secret") ||
    normalized.includes("not configured")
  ) {
    code = "CONFIGURATION";
  } else if (
    normalized.includes("token expired") ||
    normalized.includes("connect xbox again") ||
    normalized.includes("401") ||
    normalized.includes("403") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  ) {
    code = "AUTH";
  } else if (
    normalized.includes("fetch") ||
    normalized.includes("network") ||
    normalized.includes("econn") ||
    normalized.includes("enotfound")
  ) {
    code = "NETWORK";
  } else if (/\b[45]\d\d\b/.test(normalized)) {
    code = "PROVIDER";
  }

  const retryAfterMatch = normalized.match(/retry-?after[^\d]*(\d+)\s*(ms|seconds?|minutes?)/);
  const retryAfterFromMessage = retryAfterMatch
    ? Number(retryAfterMatch[1]) *
      (retryAfterMatch[2].startsWith("m") && retryAfterMatch[2] !== "ms"
        ? 60_000
        : retryAfterMatch[2] === "ms"
          ? 1
          : 1_000)
    : null;
  const retryAfterMs = getRetryAfterMs(error) ?? retryAfterFromMessage;

  return { code, message, retryAfterMs };
}

function getRetryAfterMs(error: unknown) {
  if (!error || typeof error !== "object") return null;

  const record = error as {
    response?: { headers?: Headers | Record<string, unknown> };
    retryAfter?: unknown;
  };
  const responseHeaders = record.response?.headers;
  const retryAfter =
    record.retryAfter ??
    (responseHeaders instanceof Headers
      ? responseHeaders.get("retry-after")
      : responseHeaders && typeof responseHeaders === "object"
        ? responseHeaders["retry-after"] ?? responseHeaders["Retry-After"]
        : null);
  if (typeof retryAfter === "number" && Number.isFinite(retryAfter)) {
    return Math.max(0, Math.round(retryAfter * 1000));
  }
  if (typeof retryAfter !== "string") return null;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const retryAt = new Date(retryAfter).getTime();
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : null;
}

export function sanitizePlatformSyncError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "");
  const withoutSecrets = rawMessage
    .replace(/bearer\s+[\w.~+/=-]+/gi, "Bearer [redacted]")
    .replace(
      /([?&](?:api[_-]?key|key|access[_-]?token|refresh[_-]?token|authorization|npsso|client[_-]?secret)=)[^&\s]+/gi,
      "$1[redacted]",
    )
    .replace(
      /((?:access[_-]?token|refresh[_-]?token|authorization|npsso|client[_-]?secret)\s*[:=]\s*)[^,\s}]+/gi,
      "$1[redacted]",
    )
    .replace(
      /(["']?(?:access[_-]?token|refresh[_-]?token|authorization|npsso|client[_-]?secret)["']?\s*:\s*["'])[^"']+/gi,
      "$1[redacted]",
    )
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\s+/g, " ")
    .trim();

  return (withoutSecrets || "Platform synchronization failed.").slice(0, 280);
}

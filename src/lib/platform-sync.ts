import { randomUUID } from "node:crypto";
import {
  ExternalProvider,
  PlatformSyncRunStatus,
  PlatformSyncTrigger,
  Prisma,
  type ExternalAccount,
} from "@prisma/client";
import { syncPlatformLibraryForAccount } from "@/lib/catalog";
import {
  classifyPlatformSyncError,
  getNextAutomaticSyncAt,
  getPlatformSyncPolicy,
  getRetryDelayMs,
  type PlatformSyncErrorCode,
} from "@/lib/platform-sync-policy";
import { prisma } from "@/lib/prisma";

const SCHEDULER_STATE_ID = "platform-sync";
const LEASE_BUFFER_MS = 5 * 60 * 1000;
const RUN_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export const PLATFORM_SYNC_PROVIDERS = [
  ExternalProvider.STEAM,
  ExternalProvider.PLAYSTATION,
  ExternalProvider.XBOX,
] as const;

export type PlatformSyncProvider = (typeof PLATFORM_SYNC_PROVIDERS)[number];

type SyncResult =
  | { kind: "succeeded"; syncedCount: number }
  | { kind: "skipped"; reason: "locked" | "not-connected" }
  | { code: PlatformSyncErrorCode; kind: "failed" };

type ScheduledSyncSummary = {
  disabled: boolean;
  failed: number;
  skipped: number;
  started: number;
  succeeded: number;
};

class PlatformSyncTimeoutError extends Error {
  constructor() {
    super("Platform synchronization timed out.");
    this.name = "PlatformSyncTimeoutError";
  }
}

function isPlatformSyncProvider(
  provider: ExternalProvider,
): provider is PlatformSyncProvider {
  return PLATFORM_SYNC_PROVIDERS.includes(provider as PlatformSyncProvider);
}

function getEnabledProviders() {
  const policy = getPlatformSyncPolicy();
  return PLATFORM_SYNC_PROVIDERS.filter((provider) => {
    if (provider === ExternalProvider.STEAM) return policy.steamEnabled;
    if (provider === ExternalProvider.PLAYSTATION) {
      return policy.playStationEnabled;
    }
    return policy.xboxEnabled;
  });
}

function buildLeaseExpiry(now: Date) {
  const policy = getPlatformSyncPolicy();
  return new Date(
    now.getTime() + Math.max(policy.accountTimeoutMs + LEASE_BUFFER_MS, LEASE_BUFFER_MS),
  );
}

async function recordSkippedRun({
  account,
  reason,
  trigger,
}: {
  account: Pick<ExternalAccount, "id" | "provider" | "syncFailureCount">;
  reason: "LEASE_ACTIVE";
  trigger: PlatformSyncTrigger;
}) {
  const now = new Date();
  try {
    await prisma.platformSyncRun.create({
      data: {
        externalAccountId: account.id,
        provider: account.provider,
        trigger,
        status: PlatformSyncRunStatus.SKIPPED,
        startedAt: now,
        finishedAt: now,
        attempt: account.syncFailureCount + 1,
        errorCode: reason,
      },
    });
  } catch {
    // A concurrent disconnect cascades the history. It is safe to omit a run
    // that no longer has an account to describe.
  }
}

async function acquireAccountLease({
  account,
  trigger,
}: {
  account: Pick<
    ExternalAccount,
    "id" | "provider" | "lastSyncAttemptAt" | "syncFailureCount"
  >;
  trigger: PlatformSyncTrigger;
}): Promise<
  | { account: ExternalAccount; leaseExpiresAt: Date; runId: string }
  | { reason: "locked" }
> {
  const now = new Date();
  const runId = randomUUID();
  const leaseExpiresAt = buildLeaseExpiry(now);
  const conditions: Prisma.ExternalAccountWhereInput[] = [
    {
      OR: [
        { syncLeaseExpiresAt: null },
        { syncLeaseExpiresAt: { lt: now } },
      ],
    },
  ];
  const lease = await prisma.externalAccount.updateMany({
    where: {
      id: account.id,
      provider: account.provider,
      AND: conditions,
    },
    data: {
      lastSyncAttemptAt: now,
      syncLeaseExpiresAt: leaseExpiresAt,
      syncLeaseToken: runId,
    },
  });
  if (!lease.count) {
    await recordSkippedRun({ account, reason: "LEASE_ACTIVE", trigger });
    return { reason: "locked" };
  }

  const lockedAccount = await prisma.externalAccount.findUnique({
    where: { id: account.id },
  });
  if (!lockedAccount || lockedAccount.syncLeaseToken !== runId) {
    return { reason: "locked" };
  }

  await prisma.platformSyncRun.updateMany({
    where: {
      externalAccountId: account.id,
      status: PlatformSyncRunStatus.RUNNING,
      leaseExpiresAt: { lt: now },
    },
    data: {
      status: PlatformSyncRunStatus.FAILED,
      errorCode: "LEASE_EXPIRED",
      errorMessage: "Platform synchronization lease expired.",
      finishedAt: now,
      leaseExpiresAt: null,
    },
  });

  try {
    await prisma.platformSyncRun.create({
      data: {
        id: runId,
        externalAccountId: lockedAccount.id,
        provider: lockedAccount.provider,
        trigger,
        status: PlatformSyncRunStatus.RUNNING,
        startedAt: now,
        leaseExpiresAt,
        attempt: lockedAccount.syncFailureCount + 1,
      },
    });
  } catch (error) {
    await prisma.externalAccount.updateMany({
      where: { id: account.id, syncLeaseToken: runId },
      data: { syncLeaseExpiresAt: null, syncLeaseToken: null },
    });
    throw error;
  }

  return { account: lockedAccount, leaseExpiresAt, runId };
}

async function finishSucceededRun({
  accountId,
  runId,
  syncedCount,
}: {
  accountId: string;
  runId: string;
  syncedCount: number;
}) {
  const now = new Date();
  const policy = getPlatformSyncPolicy();
  return prisma.$transaction(async (transaction) => {
    const accountUpdate = await transaction.externalAccount.updateMany({
      where: { id: accountId, syncLeaseToken: runId },
      data: {
        lastSyncedAt: now,
        nextSyncAt: getNextAutomaticSyncAt(now, policy.jitterMs),
        syncFailureCount: 0,
        lastSyncErrorCode: null,
        syncLeaseExpiresAt: null,
        syncLeaseToken: null,
      },
    });

    if (!accountUpdate.count) return false;

    await transaction.platformSyncRun.updateMany({
      where: { id: runId, status: PlatformSyncRunStatus.RUNNING },
      data: {
        status: PlatformSyncRunStatus.SUCCEEDED,
        syncedCount,
        finishedAt: now,
        leaseExpiresAt: null,
      },
    });
    return true;
  });
}

async function finishFailedRun({
  account,
  error,
  runId,
}: {
  account: Pick<ExternalAccount, "id" | "syncFailureCount">;
  error: ReturnType<typeof classifyPlatformSyncError>;
  runId: string;
}) {
  const now = new Date();
  const failureCount = account.syncFailureCount + 1;
  const retryDelayMs = getRetryDelayMs({
    errorCode: error.code,
    failureCount,
    retryAfterMs: error.retryAfterMs,
  });
  await prisma.$transaction(async (transaction) => {
    const accountUpdate = await transaction.externalAccount.updateMany({
      where: { id: account.id, syncLeaseToken: runId },
      data: {
        nextSyncAt: new Date(now.getTime() + retryDelayMs),
        syncFailureCount: { increment: 1 },
        lastSyncErrorCode: error.code,
        syncLeaseExpiresAt: null,
        syncLeaseToken: null,
      },
    });

    if (!accountUpdate.count) return;

    await transaction.platformSyncRun.updateMany({
      where: { id: runId, status: PlatformSyncRunStatus.RUNNING },
      data: {
        status: PlatformSyncRunStatus.FAILED,
        errorCode: error.code,
        errorMessage: error.message,
        finishedAt: now,
        leaseExpiresAt: null,
      },
    });
  });
}

async function runAccountSync({
  account,
  trigger,
}: {
  account: Pick<
    ExternalAccount,
    "id" | "provider" | "lastSyncAttemptAt" | "syncFailureCount"
  >;
  trigger: PlatformSyncTrigger;
}): Promise<SyncResult> {
  const lease = await acquireAccountLease({ account, trigger });
  if ("reason" in lease) {
    return { kind: "skipped", reason: lease.reason };
  }

  const policy = getPlatformSyncPolicy();
  const abortController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => {
        abortController.abort();
        reject(new PlatformSyncTimeoutError());
      },
      policy.accountTimeoutMs,
    );
  });
  const work = syncPlatformLibraryForAccount(lease.account, {
    signal: abortController.signal,
  });
  // PlayStation's SDK does not accept an AbortSignal, so it can settle after a
  // timeout. The catalog executor checks the signal before any game writes.
  void work.catch(() => undefined);

  try {
    const result = await Promise.race([work, timeout]);
    if (timeoutId) clearTimeout(timeoutId);
    const finished = await finishSucceededRun({
      accountId: lease.account.id,
      runId: lease.runId,
      syncedCount: result.syncedCount,
    });
    return finished
      ? { kind: "succeeded", syncedCount: result.syncedCount }
      : { kind: "skipped", reason: "not-connected" };
  } catch (caughtError) {
    if (timeoutId) clearTimeout(timeoutId);
    const error = classifyPlatformSyncError(caughtError);
    await finishFailedRun({ account: lease.account, error, runId: lease.runId });
    console.warn("Platform synchronization failed.", {
      code: error.code,
      provider: lease.account.provider,
      runId: lease.runId,
    });
    return { code: error.code, kind: "failed" };
  }
}

export async function runManualPlatformSync({
  provider,
  userId,
}: {
  provider: PlatformSyncProvider;
  userId: string;
}) {
  if (!isPlatformSyncProvider(provider)) {
    throw new Error("This platform does not support library synchronization.");
  }

  const account = await prisma.externalAccount.findFirst({
    where: { provider, userId },
    select: {
      id: true,
      provider: true,
      lastSyncAttemptAt: true,
      syncFailureCount: true,
    },
  });
  if (!account) return { kind: "skipped", reason: "not-connected" } as const;

  return runAccountSync({ account, trigger: PlatformSyncTrigger.MANUAL });
}

async function runScheduledBatch(
  accounts: Array<
    Pick<
      ExternalAccount,
      "id" | "provider" | "lastSyncAttemptAt" | "syncFailureCount"
    >
  >,
) {
  const policy = getPlatformSyncPolicy();
  const deadline = Date.now() + policy.runBudgetMs;
  const pending = [...accounts];
  const activeProviders = new Set<PlatformSyncProvider>();
  const active = new Set<Promise<void>>();
  const results: SyncResult[] = [];

  const startNext = () => {
    while (
      active.size < policy.maxConcurrency &&
      pending.length > 0 &&
      Date.now() < deadline
    ) {
      const index = pending.findIndex(
        (account) =>
          isPlatformSyncProvider(account.provider) &&
          !activeProviders.has(account.provider),
      );
      if (index === -1) return;

      const [account] = pending.splice(index, 1);
      if (!account || !isPlatformSyncProvider(account.provider)) continue;
      const provider = account.provider;
      activeProviders.add(provider);
      const task = runAccountSync({
        account,
        trigger: PlatformSyncTrigger.SCHEDULED,
      })
        .then((result) => {
          results.push(result);
        })
        .finally(() => {
          active.delete(task);
          activeProviders.delete(provider);
        });
      active.add(task);
    }
  };

  startNext();
  while (active.size) {
    await Promise.race(active);
    startNext();
  }

  return results;
}

export async function runDuePlatformSyncs(): Promise<ScheduledSyncSummary> {
  const policy = getPlatformSyncPolicy();
  if (!policy.enabled) {
    return { disabled: true, failed: 0, skipped: 0, started: 0, succeeded: 0 };
  }

  const providers = getEnabledProviders();
  if (!providers.length) {
    return { disabled: true, failed: 0, skipped: 0, started: 0, succeeded: 0 };
  }

  const now = new Date();
  const legacyDueAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const accounts = await prisma.externalAccount.findMany({
    where: {
      provider: { in: providers },
      OR: [
        { nextSyncAt: { lte: now } },
        { nextSyncAt: null, lastSyncedAt: null },
        { nextSyncAt: null, lastSyncedAt: { lte: legacyDueAt } },
      ],
    },
    select: {
      id: true,
      provider: true,
      lastSyncAttemptAt: true,
      syncFailureCount: true,
    },
    orderBy: [{ lastSyncedAt: "asc" }, { createdAt: "asc" }],
    take: policy.batchSize,
  });

  const results = await runScheduledBatch(accounts);
  const summary = results.reduce<ScheduledSyncSummary>(
    (current, result) => {
      if (result.kind === "succeeded") current.succeeded += 1;
      if (result.kind === "failed") current.failed += 1;
      if (result.kind === "skipped") current.skipped += 1;
      return current;
    },
    {
      disabled: false,
      failed: 0,
      skipped: 0,
      started: results.length,
      succeeded: 0,
    },
  );

  await prisma.platformSyncRun.deleteMany({
    where: {
      finishedAt: { lt: new Date(now.getTime() - RUN_RETENTION_MS) },
    },
  });
  return summary;
}

export async function getPlatformSyncOperationalSummary(now = new Date()) {
  const providers = [...PLATFORM_SYNC_PROVIDERS];
  const dueAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentRunAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [eligibleAccounts, expiredLeases, repeatedFailures, recentRuns] =
    await Promise.all([
      prisma.externalAccount.count({
        where: {
          provider: { in: providers },
          OR: [
            { nextSyncAt: { lte: now } },
            { nextSyncAt: null, lastSyncedAt: null },
            { nextSyncAt: null, lastSyncedAt: { lte: dueAt } },
          ],
        },
      }),
      prisma.externalAccount.count({
        where: {
          provider: { in: providers },
          syncLeaseExpiresAt: { lt: now },
        },
      }),
      prisma.externalAccount.count({
        where: {
          provider: { in: providers },
          syncFailureCount: { gte: 3 },
        },
      }),
      prisma.platformSyncRun.groupBy({
        by: ["provider", "status"],
        where: { createdAt: { gte: recentRunAt } },
        _count: { _all: true },
      }),
    ]);

  return {
    eligibleAccounts,
    expiredLeases,
    repeatedFailures,
    recentRuns: recentRuns.map((run) => ({
      count: run._count._all,
      provider: run.provider,
      status: run.status,
    })),
  };
}

async function acquireSchedulerLease() {
  const policy = getPlatformSyncPolicy();
  const now = new Date();
  const token = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + policy.runBudgetMs + LEASE_BUFFER_MS);
  const rateLimitCutoff = new Date(now.getTime() - policy.schedulerRateLimitMs);
  const where: Prisma.PlatformSyncSchedulerStateWhereInput = {
    id: SCHEDULER_STATE_ID,
    AND: [
      {
        OR: [
          { leaseExpiresAt: null },
          { leaseExpiresAt: { lt: now } },
        ],
      },
      {
        OR: [
          { lastTriggeredAt: null },
          { lastTriggeredAt: { lt: rateLimitCutoff } },
        ],
      },
    ],
  };
  const data = {
    lastTriggeredAt: now,
    leaseExpiresAt,
    leaseToken: token,
  };

  let lease = await prisma.platformSyncSchedulerState.updateMany({ where, data });
  if (!lease.count) {
    try {
      await prisma.platformSyncSchedulerState.create({
        data: { id: SCHEDULER_STATE_ID, ...data },
      });
      lease = { count: 1 };
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }
      lease = await prisma.platformSyncSchedulerState.updateMany({ where, data });
    }
  }

  return lease.count ? token : null;
}

export async function runScheduledPlatformSyncs() {
  const schedulerLeaseToken = await acquireSchedulerLease();
  if (!schedulerLeaseToken) {
    return { accepted: false, summary: null };
  }

  try {
    return { accepted: true, summary: await runDuePlatformSyncs() };
  } finally {
    await prisma.platformSyncSchedulerState.updateMany({
      where: { id: SCHEDULER_STATE_ID, leaseToken: schedulerLeaseToken },
      data: { leaseExpiresAt: null, leaseToken: null },
    });
  }
}

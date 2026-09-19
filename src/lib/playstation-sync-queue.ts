import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type PlatformSyncTrigger } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { importPlayStationLibraryGame, prunePlayStationNonGameEntries } from "@/lib/catalog";
import { syncPlayStationLibraryForAccount } from "@/lib/playstation";
import { getUserProfileSyncData } from "@/lib/user-profile-sync";
import { proAccountWhere, planAccountSelect } from "@/lib/plan-access";
import { hasProAccess } from "@/lib/account-plans";
import { classifyPlatformSyncError, getNextAutomaticSyncAt, getPlatformSyncPolicy } from "@/lib/platform-sync-policy";
import { PLAYSTATION_BATCH_SIZE, PLAYSTATION_WORK_BUDGET_MS, PLAYSTATION_WORK_LEASE_MS, playStationSnapshotSchema } from "@/lib/playstation-sync-state";
import { getSyncWorkerScope, steamRetryDelay as playStationRetryDelay } from "@/lib/steam-sync-state";

class LeaseLost extends Error {}

// Dependencies let the real PostgreSQL concurrency/checkpoint protocol be tested
// without making provider requests or changing anyone's library.
export function createPlayStationSyncQueue({
  db = prisma,
  importGame = importPlayStationLibraryGame,
  fetchLibrary = syncPlayStationLibraryForAccount,
}: {
  db?: PrismaClient;
  importGame?: typeof importPlayStationLibraryGame;
  fetchLibrary?: typeof syncPlayStationLibraryForAccount;
} = {}) {
  const workerScope = getSyncWorkerScope();
  async function enqueue(userId: string, trigger: PlatformSyncTrigger = "MANUAL", interruptedRunId?: string) {
    if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET?.trim()) {
      throw new Error("PlayStation background worker is not configured.");
    }
    return db.$transaction(async (tx) => {
      if (trigger === "SCHEDULED" && !await tx.user.findFirst({ where: { id: userId, ...proAccountWhere() }, select: { id: true } })) {
        return { kind: "pro-required" } as const;
      }
      // Serialize duplicate clicks and scheduled work on the account, not the user.
      await tx.externalAccount.updateMany({
        where: { userId, provider: "PLAYSTATION" }, data: { updatedAt: new Date() },
      });
      const account = await tx.externalAccount.findFirst({ where: { userId, provider: "PLAYSTATION" } });
      if (!account) return { kind: "not-connected" } as const;
      const active = await tx.platformSyncRun.findFirst({
        where: { externalAccountId: account.id, status: { in: ["PENDING", "RUNNING"] } },
        orderBy: { createdAt: "desc" },
      });
      if (interruptedRunId && active) return { kind: "superseded" } as const;
      if (active && (active.status === "PENDING" || active.workerToken || active.snapshot || (active.leaseExpiresAt && active.leaseExpiresAt > new Date()))) {
        // A manual request can resume work left over from a canceled Pro plan.
        if (trigger === "MANUAL" && active.trigger === "SCHEDULED") {
          await tx.platformSyncRun.update({ where: { id: active.id }, data: { trigger: "MANUAL" } });
        }
        return { kind: "queued", runId: active.id } as const;
      }
      if (active) {
        await tx.platformSyncRun.update({ where: { id: active.id }, data: { status: "FAILED", errorCode: "LEASE_EXPIRED", finishedAt: new Date(), leaseExpiresAt: null } });
      }
      const previous = await tx.platformSyncRun.findFirst({
        where: { externalAccountId: account.id, workerScope },
        orderBy: { createdAt: "desc" },
      });
      if (interruptedRunId && (previous?.id !== interruptedRunId || previous.trigger !== "MANUAL" || previous.status !== "FAILED" || previous.errorCode !== "LEASE_EXPIRED")) return { kind: "superseded" } as const;
      const resume = (previous?.status === "FAILED" || (previous?.status === "SKIPPED" && previous.errorCode === "PRO_REQUIRED")) && previous.snapshot &&
        playStationSnapshotSchema.safeParse(previous.snapshot).success ? previous : null;
      const run = await tx.platformSyncRun.create({
        data: {
          externalAccountId: account.id, provider: "PLAYSTATION", trigger, status: "PENDING", attempt: 0, workerScope,
          ...(resume ? {
            snapshot: resume.snapshot as Prisma.InputJsonValue,
            cursor: resume.cursor, totalCount: resume.totalCount, syncedCount: resume.syncedCount,
          } : {}),
        },
      });
      await tx.externalAccount.update({
        where: { id: account.id },
        data: { lastSyncAttemptAt: new Date(), lastSyncErrorCode: null },
      });
      return { kind: "queued", runId: run.id } as const;
    });
  }

  async function claim(runId?: string) {
    const now = new Date();
    return db.$transaction(async (tx) => {
      const eligible: Prisma.PlatformSyncRunWhereInput = {
        provider: "PLAYSTATION", workerScope, id: runId,
        status: { in: ["PENDING", "RUNNING"] }, nextAttemptAt: { lte: now },
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
      };
      const previous = await tx.platformSyncRun.findFirst({
        where: eligible, orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      });
      if (!previous) return null;
      // Compare-and-set rechecks eligibility after acquiring the row lock.
      // Prisma qualifies table names correctly for non-public schemas too.
      const claimed = await tx.platformSyncRun.updateMany({
        where: { ...eligible, id: previous.id },
        data: {
          status: "RUNNING", startedAt: previous.startedAt ?? now,
          workerToken: randomUUID(), leaseExpiresAt: new Date(now.getTime() + PLAYSTATION_WORK_LEASE_MS),
        },
      });
      if (!claimed.count) return null;
      return tx.platformSyncRun.findUniqueOrThrow({
        where: { id: previous.id },
        include: { externalAccount: { include: { user: { select: { ...planAccountSelect, lastActiveAt: true, displayName: true, avatarUrl: true } } } } },
      });
    });
  }

  async function processBatch(runId?: string, budgetMs = PLAYSTATION_WORK_BUDGET_MS) {
    const deadline = Date.now() + budgetMs;
    const run = await claim(runId);
    if (!run) return false;
    const account = run.externalAccount;
    const fence = { id: run.id, workerToken: run.workerToken, status: "RUNNING" as const };
    if (run.trigger === "SCHEDULED" && !hasProAccess(account.user)) {
      await db.platformSyncRun.updateMany({ where: fence, data: {
        status: "SKIPPED", errorCode: "PRO_REQUIRED", finishedAt: new Date(), workerToken: null, leaseExpiresAt: null,
      } });
      return true;
    }

    const assertLease = async (tx: Prisma.TransactionClient) => {
      // Keep the account -> run lock order used by enqueue.
      const owner = await tx.externalAccount.updateMany({ where: { id: account.id, userId: account.userId }, data: { updatedAt: new Date() } });
      if (!owner.count) throw new LeaseLost();
      const result = await tx.platformSyncRun.updateMany({
        where: { ...fence, leaseExpiresAt: { gt: new Date() } },
        data: { updatedAt: new Date() },
      });
      if (!result.count) throw new LeaseLost();
      // Lock held through checkpoint commit: expired workers cannot commit late.
    };

    try {
      let snapshot = run.snapshot;
      if (!snapshot) {
        const signal = AbortSignal.timeout(15_000);
        // The provider SDK cannot cancel a pending request; the signal prevents
        // subsequent pages/account writes and the race bounds this worker tick.
        const aborted = new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new Error("PlayStation library request timed out.")), { once: true }));
        const { profile, games } = await Promise.race([fetchLibrary(account, { signal }), aborted]);
        snapshot = JSON.parse(JSON.stringify({
          version: 1, games: games.map(game => ({ ...game, lastPlayedAt: game.lastPlayedAt?.toISOString() ?? null })),
        })) as Prisma.JsonValue;
        playStationSnapshotSchema.parse(snapshot);
        await db.$transaction(async tx => {
          await assertLease(tx);
          await tx.user.update({ where: { id: account.userId }, data: getUserProfileSyncData(account.user, profile) });
          await tx.externalAccount.update({ where: { id: account.id }, data: {
            username: profile.username, displayName: profile.displayName,
            avatarUrl: profile.avatarUrl, profileUrl: profile.profileUrl,
          } });
          await tx.platformSyncRun.update({ where: { id: run.id }, data: {
            snapshot: snapshot as Prisma.InputJsonValue, totalCount: games.length, lastProgressAt: new Date(),
          } });
        });
      }
      const { games } = playStationSnapshotSchema.parse(snapshot);
      let cursor = run.cursor;
      const batchEnd = Math.min(games.length, cursor + PLAYSTATION_BATCH_SIZE);
      while (cursor < batchEnd && Date.now() < deadline) {
        const game = games[cursor];
        await db.$transaction(async tx => {
          await assertLease(tx);
          // Canonical matching, ownership and progress commit together. If the
          // process dies, this one item is rolled back and safely replayed.
          await importGame(account, {
            ...game, lastPlayedAt: game.lastPlayedAt ? new Date(game.lastPlayedAt) : null,
          }, tx);
          await tx.platformSyncRun.update({ where: { id: run.id }, data: {
            cursor: cursor + 1, syncedCount: cursor + 1, attempt: 0, errorCode: null, errorMessage: null,
            lastProgressAt: new Date(),
          } });
        }, { timeout: 20_000, maxWait: 5_000 });
        cursor++;
      }
      await db.$transaction(async tx => {
        await assertLease(tx);
        const done = cursor === games.length;
        if (done) await prunePlayStationNonGameEntries(account.id, tx);
        await tx.platformSyncRun.update({ where: { id: run.id }, data: {
          status: done ? "SUCCEEDED" : "PENDING", workerToken: null, leaseExpiresAt: null,
          nextAttemptAt: new Date(), finishedAt: done ? new Date() : null,
          ...(done ? { snapshot: Prisma.DbNull, syncedCount: cursor } : {}),
        } });
        await tx.externalAccount.update({ where: { id: account.id }, data: {
          syncLeaseToken: null, syncLeaseExpiresAt: null,
          ...(done ? {
            lastSyncedAt: new Date(), lastSyncErrorCode: null, syncFailureCount: 0,
            nextSyncAt: getNextAutomaticSyncAt(new Date(), getPlatformSyncPolicy().jitterMs, Math.random, account.user.lastActiveAt),
          } : {}),
        } });
      });
    } catch (caught) {
      if (caught instanceof LeaseLost) return true;
      const error = classifyPlatformSyncError(caught);
      await db.$transaction(async tx => {
        const owner = await tx.externalAccount.updateMany({ where: { id: account.id, userId: account.userId }, data: { updatedAt: new Date() } });
        if (!owner.count) return;
        const current = await tx.platformSyncRun.findFirst({ where: fence });
        if (!current) return;
        const attempt = current.attempt + 1;
        const retryDelay = playStationRetryDelay(attempt, error.code);
        const delay = retryDelay === null ? null : Math.max(retryDelay, error.retryAfterMs ?? 0);
        const changed = await tx.platformSyncRun.updateMany({ where: fence, data: {
          status: delay === null ? "FAILED" : "PENDING", attempt,
          workerToken: null, leaseExpiresAt: null, errorCode: error.code, errorMessage: error.message,
          nextAttemptAt: new Date(Date.now() + (delay ?? 0)), finishedAt: delay === null ? new Date() : null,
        } });
        if (!changed.count) return;
        await tx.externalAccount.update({ where: { id: account.id }, data: {
          lastSyncErrorCode: error.code, syncFailureCount: { increment: 1 },
          syncLeaseToken: null, syncLeaseExpiresAt: null,
          nextSyncAt: new Date(Date.now() + (delay ?? 24 * 60 * 60_000)),
        } });
      });
      console.warn("PlayStation background batch failed.", { runId: run.id, code: error.code });
    }
    return true;
  }

  async function drain(runId?: string) {
    const deadline = Date.now() + PLAYSTATION_WORK_BUDGET_MS;
    let worked = false;
    while (Date.now() < deadline) {
      if (!await processBatch(runId, deadline - Date.now())) break;
      worked = true;
    }
    return worked;
  }

  async function recoverInterruptedManualRuns() {
    // Repair accepted legacy manual work, independently of Pro daily scheduling.
    const interrupted = await db.platformSyncRun.findMany({
      where: { provider: "PLAYSTATION", workerScope, trigger: "MANUAL", status: "FAILED", errorCode: "LEASE_EXPIRED",
        externalAccount: { lastSyncErrorCode: "LEASE_EXPIRED", nextSyncAt: { lte: new Date() } } },
      orderBy: { createdAt: "desc" }, distinct: ["externalAccountId"], take: 10,
      include: { externalAccount: { select: { userId: true } } },
    });
    const deadline = Date.now() + 8_000;
    for (const run of interrupted) {
      if (Date.now() >= deadline) break;
      await enqueue(run.externalAccount.userId, "MANUAL", run.id);
    }
  }

  return { enqueue, processBatch, drain, recoverInterruptedManualRuns };
}

export const playStationSyncQueue = createPlayStationSyncQueue();

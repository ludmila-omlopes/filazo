import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type PlatformSyncTrigger } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { importSteamLibraryGame } from "@/lib/catalog";
import { steamAdapter } from "@/lib/steam";
import { getUserProfileSyncData } from "@/lib/user-profile-sync";
import { classifyPlatformSyncError, getNextAutomaticSyncAt, getPlatformSyncPolicy } from "@/lib/platform-sync-policy";
import { STEAM_BATCH_SIZE, STEAM_WORK_BUDGET_MS, STEAM_WORK_LEASE_MS, getSyncWorkerScope, steamRetryDelay, steamSnapshotSchema } from "@/lib/steam-sync-state";

class LeaseLost extends Error {}

// Dependencies let the real PostgreSQL concurrency/checkpoint protocol be tested
// without making provider requests or changing anyone's library.
export function createSteamSyncQueue({
  db = prisma,
  importGame = importSteamLibraryGame,
  fetchProfile = steamAdapter.fetchProfile,
  fetchLibrary = steamAdapter.syncOwnedLibrary,
}: {
  db?: PrismaClient;
  importGame?: typeof importSteamLibraryGame;
  fetchProfile?: typeof steamAdapter.fetchProfile;
  fetchLibrary?: typeof steamAdapter.syncOwnedLibrary;
} = {}) {
  const workerScope = getSyncWorkerScope();
  async function enqueue(userId: string, trigger: PlatformSyncTrigger = "MANUAL") {
    if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET?.trim()) {
      throw new Error("Steam background worker is not configured.");
    }
    return db.$transaction(async (tx) => {
      // Serialize duplicate clicks and scheduled work on the account, not the user.
      await tx.externalAccount.updateMany({
        where: { userId, provider: "STEAM" }, data: { updatedAt: new Date() },
      });
      const account = await tx.externalAccount.findFirst({ where: { userId, provider: "STEAM" } });
      if (!account) return { kind: "not-connected" } as const;
      const active = await tx.platformSyncRun.findFirst({
        where: { externalAccountId: account.id, status: { in: ["PENDING", "RUNNING"] } },
        orderBy: { createdAt: "desc" },
      });
      if (active) return { kind: "queued", runId: active.id } as const;
      const previous = await tx.platformSyncRun.findFirst({
        where: { externalAccountId: account.id, workerScope },
        orderBy: { createdAt: "desc" },
      });
      const resume = previous?.status === "FAILED" && previous.snapshot &&
        steamSnapshotSchema.safeParse(previous.snapshot).success ? previous : null;
      const run = await tx.platformSyncRun.create({
        data: {
          externalAccountId: account.id, provider: "STEAM", trigger, status: "PENDING", attempt: 0, workerScope,
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
        provider: "STEAM", workerScope, id: runId,
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
          workerToken: randomUUID(), leaseExpiresAt: new Date(now.getTime() + STEAM_WORK_LEASE_MS),
        },
      });
      if (!claimed.count) return null;
      return tx.platformSyncRun.findUniqueOrThrow({
        where: { id: previous.id },
        include: { externalAccount: { include: { user: { select: { lastActiveAt: true, displayName: true, avatarUrl: true } } } } },
      });
    });
  }

  async function processBatch(runId?: string, budgetMs = STEAM_WORK_BUDGET_MS) {
    const deadline = Date.now() + budgetMs;
    const run = await claim(runId);
    if (!run) return false;
    const account = run.externalAccount;
    const fence = { id: run.id, workerToken: run.workerToken, status: "RUNNING" as const };

    const assertLease = async (tx: Prisma.TransactionClient) => {
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
        const options = { signal: AbortSignal.timeout(15_000) };
        const [profile, games] = await Promise.all([
          fetchProfile(account.providerAccountId, options),
          fetchLibrary(account.providerAccountId, options),
        ]);
        snapshot = JSON.parse(JSON.stringify({
          version: 1, games: games.map(game => ({ ...game, lastPlayedAt: game.lastPlayedAt?.toISOString() ?? null })),
        })) as Prisma.JsonValue;
        steamSnapshotSchema.parse(snapshot);
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
      const { games } = steamSnapshotSchema.parse(snapshot);
      let cursor = run.cursor;
      const batchEnd = Math.min(games.length, cursor + STEAM_BATCH_SIZE);
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
        const current = await tx.platformSyncRun.findFirst({ where: fence });
        if (!current) return;
        const attempt = current.attempt + 1;
        const retryDelay = steamRetryDelay(attempt, error.code);
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
      console.warn("Steam background batch failed.", { runId: run.id, code: error.code });
    }
    return true;
  }

  async function drain(runId?: string) {
    const deadline = Date.now() + STEAM_WORK_BUDGET_MS;
    let worked = false;
    while (Date.now() < deadline) {
      if (!await processBatch(runId, deadline - Date.now())) break;
      worked = true;
    }
    return worked;
  }

  return { enqueue, processBatch, drain };
}

export const steamSyncQueue = createSteamSyncQueue();

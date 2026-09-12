import { randomUUID } from "node:crypto";
import { Prisma, type ExternalAccount, type PrismaClient, type PlatformSyncTrigger } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProviderProfile, SyncedLibraryGame } from "@/lib/providers/contracts";
import { getUserProfileSyncData } from "@/lib/user-profile-sync";
import { classifyPlatformSyncError, getNextAutomaticSyncAt, getPlatformSyncPolicy } from "@/lib/platform-sync-policy";
import { STEAM_BATCH_SIZE, STEAM_WORK_BUDGET_MS, STEAM_WORK_LEASE_MS, getSyncWorkerScope, steamRetryDelay, steamSnapshotSchema } from "@/lib/steam-sync-state";

class LeaseLost extends Error {}

// Dependencies let the real PostgreSQL concurrency/checkpoint protocol be tested
// without making provider requests or changing anyone's library.
export type LibraryPage = {
  games: SyncedLibraryGame[];
  profile: ProviderProfile;
  nextPage: number | null;
  totalCount: number;
};

export function createLibrarySyncQueue({
  provider,
  db = prisma,
  importGame,
  fetchPage,
}: {
  provider: "STEAM" | "GOG";
  db?: PrismaClient;
  importGame: (
    account: Pick<ExternalAccount, "id" | "userId">,
    game: SyncedLibraryGame,
    tx: Prisma.TransactionClient,
  ) => Promise<void>;
  fetchPage: (account: ExternalAccount, page: number, signal: AbortSignal) => Promise<LibraryPage>;
}) {
  const workerScope = getSyncWorkerScope();
  async function enqueue(userId: string, trigger: PlatformSyncTrigger = "MANUAL") {
    if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET?.trim()) {
      throw new Error(`${provider} background worker is not configured.`);
    }
    return db.$transaction(async (tx) => {
      // Serialize duplicate clicks and scheduled work on the account, not the user.
      await tx.externalAccount.updateMany({
        where: { userId, provider }, data: { updatedAt: new Date() },
      });
      const account = await tx.externalAccount.findFirst({ where: { userId, provider } });
      if (!account) return { kind: "not-connected" } as const;
      const active = await tx.platformSyncRun.findFirst({
        where: { externalAccountId: account.id, workerScope, status: { in: ["PENDING", "RUNNING"] } },
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
          externalAccountId: account.id, provider, trigger, status: "PENDING", attempt: 0, workerScope,
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
        provider, workerScope, id: runId,
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
      let snapshot = run.snapshot ? steamSnapshotSchema.parse(run.snapshot) : null;
      let offset = snapshot?.pagination?.offset ?? 0;
      const nextPage = snapshot?.pagination?.nextPage ?? null;
      // A paged provider keeps only its current page in the snapshot. Fetch the
      // next page only after every item on the saved page has committed.
      if (!snapshot || (run.cursor === offset + snapshot.games.length && nextPage !== null)) {
        const page = nextPage ?? 1;
        const result = await fetchPage(account, page, AbortSignal.timeout(15_000));
        if (result.profile.providerAccountId !== account.providerAccountId ||
            !Number.isSafeInteger(result.totalCount) || result.totalCount < 0 ||
            (result.nextPage !== null && result.nextPage !== page + 1) ||
            (!result.games.length && result.nextPage !== null)) {
          throw new Error("Provider returned invalid library pagination or account.");
        }
        offset = run.cursor;
        snapshot = steamSnapshotSchema.parse(JSON.parse(JSON.stringify({
          version: 1,
          games: result.games.map(game => ({ ...game, lastPlayedAt: game.lastPlayedAt?.toISOString() ?? null })),
          pagination: { offset, nextPage: result.nextPage },
        })));
        const savedSnapshot = snapshot;
        await db.$transaction(async tx => {
          await assertLease(tx);
          await tx.user.update({ where: { id: account.userId }, data: getUserProfileSyncData(account.user, result.profile) });
          await tx.externalAccount.update({ where: { id: account.id }, data: {
            username: result.profile.username, displayName: result.profile.displayName,
            avatarUrl: result.profile.avatarUrl, profileUrl: result.profile.profileUrl,
          } });
          await tx.platformSyncRun.update({ where: { id: run.id }, data: {
            snapshot: savedSnapshot as Prisma.InputJsonValue, totalCount: result.totalCount,
            lastProgressAt: new Date(), attempt: 0, errorCode: null, errorMessage: null,
          } });
        });
      }
      const { games, pagination } = snapshot;
      let cursor = run.cursor;
      if (cursor < offset || cursor > offset + games.length) {
        throw new Error("Invalid library checkpoint.");
      }
      const batchEnd = Math.min(offset + games.length, cursor + STEAM_BATCH_SIZE);
      while (cursor < batchEnd && Date.now() < deadline) {
        const game = games[cursor - offset];
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
        const done = cursor === offset + games.length && pagination?.nextPage == null;
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
      console.warn("Library background batch failed.", { provider, runId: run.id, code: error.code });
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

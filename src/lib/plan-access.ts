import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.ts";
import { billingLiveMode } from "./billing-policy.ts";
import { hasProAccess, ProRequiredError } from "./account-plans.ts";
import { canAddJournalMedia, getPlanLimits } from "./plan-policy.ts";

export const planAccountSelect = {
  plan: true,
  billingSubscriptions: { select: { status: true, livemode: true, paidThrough: true } },
} satisfies Prisma.UserSelect;

export function proAccountWhere(now = new Date()): Prisma.UserWhereInput {
  return { OR: [
    { plan: "PRO" },
    { billingSubscriptions: { some: { livemode: billingLiveMode(), status: { in: ["active", "past_due"] }, paidThrough: { gt: now } } } },
  ] };
}

export async function getPlanAccount(userId: string, db: Pick<typeof prisma, "user"> = prisma) {
  return db.user.findUnique({ where: { id: userId }, select: planAccountSelect });
}

export async function requireUserPro(userId: string) {
  if (!hasProAccess(await getPlanAccount(userId))) throw new ProRequiredError();
}

export class JournalStorageLimitError extends Error {
  constructor() { super("JOURNAL_STORAGE_LIMIT"); this.name = "JournalStorageLimitError"; }
}

export async function getJournalStorage(userId: string, db: Pick<typeof prisma, "user" | "journalMedia"> = prisma) {
  const [account, media] = await Promise.all([
    getPlanAccount(userId, db),
    db.journalMedia.aggregate({ where: { journalEntry: { userId } }, _sum: { sizeBytes: true } }),
  ]);
  if (!account) throw new Error("Account unavailable.");
  const limit = getPlanLimits(account).journalStorageBytes;
  const used = media._sum.sizeBytes ?? 0;
  return { limit, used, remaining: Math.max(0, limit - used) };
}

export async function assertJournalStorage(userId: string, added: number, db: Pick<typeof prisma, "user" | "journalMedia"> = prisma) {
  const storage = await getJournalStorage(userId, db);
  if (!canAddJournalMedia(storage.used, added, storage.limit)) throw new JournalStorageLimitError();
}

export function withJournalStorage<T>(userId: string, added: number, save: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`journal-storage:${userId}`}, 0))`;
    if (added) await assertJournalStorage(userId, added, tx);
    return save(tx);
  });
}

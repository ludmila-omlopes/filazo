import assert from "node:assert/strict";
import { prisma as db } from "../../src/lib/prisma";
import { createSteamSyncQueue } from "../../src/lib/steam-sync-queue";
import { assertJournalStorage, getJournalStorage, getPlanAccount, proAccountWhere, withJournalStorage } from "../../src/lib/plan-access";
import { getPlanLimits } from "../../src/lib/plan-policy";
import { billingLiveMode } from "../../src/lib/billing-policy";

async function main() {
  assert.match(new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "", /^steam_sync_test_[a-f0-9]{16}$/);
  process.env.CRON_SECRET = "pro-test-worker";
  process.env.FREE_JOURNAL_STORAGE_MIB = "1";
  process.env.PRO_JOURNAL_STORAGE_MIB = "2";
  const free = await db.user.create({ data: {} });
  const pro = await db.user.create({ data: { plan: "PRO" } });
  const game = await db.game.create({ data: { slug: "plan-fixture", name: "Plan fixture", normalizedName: "planfixture" } });
  const entry = await db.userGameEntry.create({ data: { userId: free.id, gameId: game.id, source: "MANUAL", status: "OWNED" } });
  const save = (bytes: number) => withJournalStorage(free.id, bytes, tx => tx.gameJournalEntry.create({ data: {
    userId: free.id, gameId: game.id, userGameEntryId: entry.id, body: "Private memory",
    ...(bytes ? { media: { create: { kind: "image", url: "fixture", storageKey: crypto.randomUUID(), mimeType: "image/png", sizeBytes: bytes } } } : {}),
  } }));
  const concurrent = await Promise.allSettled([save(700000), save(700000)]);
  assert.equal(concurrent.filter(result => result.status === "fulfilled").length, 1);
  assert.equal((await getJournalStorage(free.id)).used, 700000);
  assert.equal((await getJournalStorage(pro.id)).used, 0);
  await db.user.update({ where: { id: free.id }, data: { plan: "PRO" } });
  await save(700000);
  await db.user.update({ where: { id: free.id }, data: { plan: "FREE" } });
  await assert.rejects(assertJournalStorage(free.id, 1), /JOURNAL_STORAGE_LIMIT/);
  await save(0);
  assert.equal(await db.gameJournalEntry.count({ where: { userId: free.id } }), 3);
  assert.equal(await db.journalMedia.count({ where: { journalEntry: { userId: free.id } } }), 2);
  console.log("PASS concurrent storage limits, user isolation and retained memories after downgrade.");

  let calls = 0;
  const queue = createSteamSyncQueue({ db,
    fetchLibrary: async () => { calls++; return []; },
    fetchProfile: async () => ({ providerAccountId: "fixture" }),
  });
  await db.externalAccount.create({ data: { userId: free.id, provider: "STEAM", providerAccountId: "pro-test-free" } });
  await db.externalAccount.create({ data: { userId: pro.id, provider: "STEAM", providerAccountId: "pro-test-pro" } });
  assert.equal((await queue.enqueue(free.id, "SCHEDULED")).kind, "pro-required");
  const manual = await queue.enqueue(free.id, "MANUAL");
  assert.equal(manual.kind, "queued");
  if (manual.kind !== "queued") throw Error("Missing manual job");
  await queue.processBatch(manual.runId);
  assert.equal(calls, 1);
  const scheduled = await queue.enqueue(pro.id, "SCHEDULED");
  if (scheduled.kind !== "queued") throw Error("Missing scheduled job");
  await db.user.update({ where: { id: pro.id }, data: { plan: "FREE" } });
  await queue.processBatch(scheduled.runId);
  assert.equal(calls, 1);
  assert.equal((await db.platformSyncRun.findUniqueOrThrow({ where: { id: scheduled.runId } })).status, "SKIPPED");
  assert.equal((await queue.enqueue(pro.id, "MANUAL")).kind, "queued");
  console.log("PASS Free manual sync and suspended scheduled work after Pro expiry.");

  const customer = await db.billingCustomer.create({ data: { userId: pro.id, livemode: billingLiveMode() } });
  await db.billingSubscription.create({ data: { id: "pro-check-sub", userId: pro.id, customerId: customer.id, livemode: billingLiveMode(),
    status: "active", priceId: "fixture", currentPeriodEnd: new Date(Date.now() + 60000), paidThrough: new Date(Date.now() + 60000), cancelAtPeriodEnd: true,
  } });
  assert.equal(getPlanLimits(await getPlanAccount(pro.id)).calendar, true);
  assert.ok(await db.user.findFirst({ where: { id: pro.id, ...proAccountWhere() } }));
  await db.billingSubscription.update({ where: { id: "pro-check-sub" }, data: { paidThrough: new Date(Date.now() - 60000) } });
  assert.equal(getPlanLimits(await getPlanAccount(pro.id)).calendar, false);
  assert.equal(await db.user.findFirst({ where: { id: pro.id, ...proAccountWhere() } }), null);
  console.log("PASS paid-until access and scheduler entitlement parity.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());

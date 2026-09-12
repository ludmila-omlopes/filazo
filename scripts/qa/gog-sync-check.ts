import assert from "node:assert/strict";
import { prisma as db } from "../../src/lib/prisma";
import { createGogSyncQueue } from "../../src/lib/gog-sync-queue";
import { createSteamSyncQueue } from "../../src/lib/steam-sync-queue";
import { importGogLibraryGame } from "../../src/lib/catalog";
import { steamSnapshotSchema } from "../../src/lib/steam-sync-state";
import { igdbAdapter } from "../../src/lib/igdb";
import type { SyncedLibraryGame } from "../../src/lib/providers/contracts";

async function main() {
  assert.match(new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "", /^steam_sync_test_[a-f0-9]{16}$/);
  process.env.CRON_SECRET = "gog-queue-test-secret";
  igdbAdapter.searchBestMatch = async () => null;
  const user = await db.user.create({ data: { displayName: "GOG queue fixture" } });
  const account = await db.externalAccount.create({ data: {
    userId: user.id, provider: "GOG", providerAccountId: "123456",
  } });
  const games: SyncedLibraryGame[] = Array.from({ length: 105 }, (_, index) => ({
    providerGameId: String(1000 + index), title: `GOG Queue Game ${index}`, platformName: "GOG",
  }));
  const canonical = await db.game.create({ data: {
    slug: "gog-linked", name: "Existing shared title", normalizedName: "existingsharedtitle",
    providerLinks: { create: { provider: "GOG", providerGameId: "1000" } },
  } });
  await db.userGameEntry.create({ data: {
    userId: user.id, gameId: canonical.id, status: "OWNED", provider: "STEAM", source: "STEAM",
    platformName: "Steam", playtimeMinutes: 777, playtimeSource: "manual",
  } });
  const fetched: number[] = [];
  let failPage = true;
  let failItem = true;
  const fetchPage: NonNullable<Parameters<typeof createGogSyncQueue>[0]>["fetchPage"] = async (_account, page) => {
    fetched.push(page);
    if (page === 2 && failPage) throw new Error("network page failure");
    return {
      profile: { providerAccountId: account.providerAccountId, username: "renamed_player" },
      games: games.slice((page - 1) * 50, page * 50),
      nextPage: page < 3 ? page + 1 : null, totalCount: games.length,
    };
  };
  const options = {
    db, fetchPage,
    importGame: async (...args: Parameters<typeof importGogLibraryGame>) => {
      await importGogLibraryGame(...args);
      if (failItem && args[1].providerGameId === "1053") throw new Error("network item failure");
    },
  };
  const queue = createGogSyncQueue(options);
  const [click, scheduled] = await Promise.all([queue.enqueue(user.id), queue.enqueue(user.id, "SCHEDULED")]);
  assert.deepEqual(click, scheduled, "manual and scheduled work deduplicate");
  if (click.kind !== "queued") throw new Error("No GOG job");
  const id = click.runId;
  assert.equal(await createSteamSyncQueue({ db }).processBatch(id), false, "Steam cannot claim GOG work");
  const read = () => db.platformSyncRun.findUniqueOrThrow({ where: { id } });
  let run = await read();
  for (let batch = 0; batch < 40 && run.errorCode === null; batch++) {
    await queue.processBatch(id);
    run = await read();
  }
  assert.equal(run.cursor, 50);
  assert.equal(run.errorCode, "NETWORK");
  assert.equal(steamSnapshotSchema.parse(run.snapshot).pagination?.nextPage, 2);
  assert.equal(await queue.processBatch(id), false, "provider backoff must be respected");
  assert.deepEqual(fetched, [1, 2]);
  console.log("PASS page checkpoint and failed page resume without refetching page one.");

  failPage = false;
  await db.platformSyncRun.update({ where: { id }, data: { nextAttemptAt: new Date(0) } });
  const resumed = createGogSyncQueue(options);
  await resumed.processBatch(id);
  run = await read();
  assert.equal(run.cursor, 53);
  assert.equal(await db.userGameEntry.count({ where: { userId: user.id } }), 53);
  assert.equal(await db.game.count(), 53, "failed item must roll back canonical creation too");
  assert.equal(steamSnapshotSchema.parse(run.snapshot).pagination?.offset, 50);
  assert.deepEqual(fetched, [1, 2, 2]);
  console.log("PASS item, canonical game, ownership and cursor roll back atomically.");

  failItem = false;
  await db.platformSyncRun.update({ where: { id }, data: { nextAttemptAt: new Date(0) } });
  for (let batch = 0; batch < 40; batch++) {
    await createGogSyncQueue(options).processBatch(id);
    run = await read();
    if (run.status === "SUCCEEDED") break;
    assert.equal(run.errorCode, null);
    assert.equal(run.status, "PENDING");
    assert.ok(steamSnapshotSchema.parse(run.snapshot).games.length <= 50, "snapshot retains one page only");
  }
  assert.equal(run.status, "SUCCEEDED");
  assert.equal(run.cursor, 105);
  assert.equal(run.snapshot, null);
  assert.deepEqual(fetched, [1, 2, 2, 3], "saved page must survive worker restarts");
  assert.equal(await db.userGameEntry.count({ where: { userId: user.id } }), 105);
  assert.equal(await db.userGameProviderLink.count({ where: { externalAccountId: account.id } }), 105);
  const preserved = await db.userGameEntry.findUniqueOrThrow({ where: {
    userId_gameId_status: { userId: user.id, gameId: canonical.id, status: "OWNED" },
  } });
  assert.equal(preserved.provider, "STEAM");
  assert.equal(preserved.playtimeMinutes, 777);
  assert.ok((await db.externalAccount.findUniqueOrThrow({ where: { id: account.id } })).lastSyncedAt);
  console.log("PASS background completion, bounded snapshot, no duplicates and preservation of other providers.");

  // Seed a persisted checkpoint beyond the old 100-page ceiling.
  const large = await queue.enqueue(user.id);
  if (large.kind !== "queued") throw new Error("No large job");
  await db.platformSyncRun.update({ where: { id: large.runId }, data: {
    cursor: 5000, totalCount: 5001, syncedCount: 5000,
    snapshot: { version: 1, games: [], pagination: { offset: 5000, nextPage: 101 } },
  } });
  let requested = 0;
  const largeQueue = createGogSyncQueue({ db, fetchPage: async (_owner, page) => {
    requested = page;
    return {
      profile: { providerAccountId: account.providerAccountId },
      games: [{ providerGameId: "999999", title: "Game after page 100" }],
      nextPage: null, totalCount: 5001,
    };
  } });
  await largeQueue.processBatch(large.runId);
  const largeRun = await db.platformSyncRun.findUniqueOrThrow({ where: { id: large.runId } });
  assert.equal(requested, 101);
  assert.equal(largeRun.status, "SUCCEEDED");
  assert.equal(largeRun.cursor, 5001);
  console.log("PASS continuation beyond 100 pages.");

  const retry = await queue.enqueue(user.id);
  if (retry.kind !== "queued") throw new Error("No retry job");
  await db.platformSyncRun.update({ where: { id: retry.runId }, data: {
    status: "FAILED", cursor: 5000, totalCount: 5001,
    snapshot: { version: 1, games: [], pagination: { offset: 5000, nextPage: 101 } },
  } });
  const continued = await largeQueue.enqueue(user.id);
  if (continued.kind !== "queued") throw new Error("No continuation");
  assert.notEqual(continued.runId, retry.runId);
  await largeQueue.processBatch(continued.runId);
  assert.equal((await db.platformSyncRun.findUniqueOrThrow({ where: { id: continued.runId } })).cursor, 5001);
  assert.equal((await db.platformSyncRun.findUniqueOrThrow({ where: { id: retry.runId } })).status, "FAILED");
  console.log("PASS manual continuation preserves failure audit and page cursor.");

  // Two workers overlap while a provider request is stalled. Only the winner commits.
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<void>(resolve => { started = resolve; });
  const slow = createGogSyncQueue({ db, fetchPage: async () => {
    started(); await waiting;
    return { profile: { providerAccountId: account.providerAccountId }, games: [], nextPage: null, totalCount: 0 };
  } });
  const stale = await slow.enqueue(user.id);
  if (stale.kind !== "queued") throw new Error("No stale job");
  const running = slow.processBatch(stale.runId);
  await ready;
  assert.equal(await largeQueue.processBatch(stale.runId), false);
  await db.platformSyncRun.update({ where: { id: stale.runId }, data: { leaseExpiresAt: new Date(0) } });
  await largeQueue.processBatch(stale.runId);
  release(); await running;
  assert.equal((await db.platformSyncRun.findUniqueOrThrow({ where: { id: stale.runId } })).cursor, 1);
  console.log("PASS expired lease recovery and late worker fencing.");

  const disconnected = await queue.enqueue(user.id);
  if (disconnected.kind !== "queued") throw new Error("No disconnect job");
  await db.externalAccount.delete({ where: { id: account.id } });
  assert.equal(await queue.processBatch(disconnected.runId), false);
  console.log("PASS disconnect cancels queued work. All GOG queue checks passed.");
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());

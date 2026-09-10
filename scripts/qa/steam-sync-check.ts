import assert from "node:assert/strict";
import { Prisma, type PlatformSyncRun } from "@prisma/client";
import { prisma as db } from "../../src/lib/prisma";
import { createSteamSyncQueue } from "../../src/lib/steam-sync-queue";
import { importSteamLibraryGame } from "../../src/lib/catalog";
import { igdbAdapter } from "../../src/lib/igdb";
import { hasInternalWorkerAuth } from "../../src/lib/internal-worker-auth";
import { normalizeTitle } from "../../src/lib/utils";
import type { SyncedLibraryGame } from "../../src/lib/providers/contracts";

async function main() {
  assert.match(new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "", /^steam_sync_test_[a-f0-9]{16}$/);
  process.env.CRON_SECRET = "queue-test-secret";
  assert.equal(hasInternalWorkerAuth(new Request("http://localhost/worker")), false);
  assert.equal(hasInternalWorkerAuth(new Request("http://localhost/worker", { headers: { authorization: "Bearer wrong" } })), false);
  assert.equal(hasInternalWorkerAuth(new Request("http://localhost/worker", { headers: { authorization: "Bearer queue-test-secret" } })), true);

  const user = await db.user.create({ data: { displayName: "Queue fixture" } });
  const account = await db.externalAccount.create({ data: { userId: user.id, provider: "STEAM", providerAccountId: "76561190000000001" } });
  const other = await db.user.create({ data: {} });
  const games: SyncedLibraryGame[] = Array.from({ length: 105 }, (_, i) => ({
    providerGameId: String(1000 + i), title: `Queue Game ${i}`, platformName: "Steam", playtimeMinutes: 90,
    lastPlayedAt: new Date("2026-08-01T12:00:00Z"),
  }));
  // Game 0 already exists under a different provider/name; Steam ID wins.
  const linked = await db.game.create({ data: {
    slug: "linked", name: "Original canonical title", normalizedName: "originalcanonicaltitle",
    providerLinks: { create: { provider: "STEAM", providerGameId: "1000" } },
  } });
  // Game 1 resolves by normalized title, while game 2 resolves by IGDB ID.
  const normalized = await db.game.create({ data: {
    slug: "normalized", name: games[1].title, normalizedName: normalizeTitle(games[1].title),
  } });
  const byIgdb = await db.game.create({ data: {
    slug: "igdb", name: "Other spelling", normalizedName: "otherspelling", igdbId: 987654,
    summary: "Existing", coverUrl: "https://example.com/cover", heroUrl: "https://example.com/hero",
  } });
  // Replace optional metadata networking only inside this isolated test process.
  igdbAdapter.searchBestMatch = async ({ title }) => title === games[2].title ? {
    igdbId: 987654, name: byIgdb.name, slug: "igdb", summary: "Existing",
  } : null;
  await db.userGameEntry.create({ data: {
    userId: user.id, gameId: linked.id, status: "OWNED", source: "MANUAL", playtimeMinutes: 777, playtimeSource: "manual",
  } });
  let fetches = 0;
  let fail = true;
  const providers = {
    db,
    fetchProfile: async () => ({ providerAccountId: account.providerAccountId, displayName: "Queue fixture" }),
    fetchLibrary: async () => { fetches++; return games; },
  };
  const queue = createSteamSyncQueue({ ...providers, importGame: async (owner, game, tx) => {
    await importSteamLibraryGame(owner, game, tx);
    // Failure AFTER ownership write proves the item and cursor roll back together.
    if (fail && game.providerGameId === "1003") throw new Error("network interruption fixture");
  } });
  assert.deepEqual(await queue.enqueue(other.id), { kind: "not-connected" });
  const clicks = await Promise.all([queue.enqueue(user.id), queue.enqueue(user.id)]);
  assert.equal(clicks[0].kind, "queued");
  assert.deepEqual(clicks[0], clicks[1]);
  if (clicks[0].kind !== "queued") throw new Error("No job");
  const id = clicks[0].runId;
  await queue.processBatch(id);
  let run = await db.platformSyncRun.findUniqueOrThrow({ where: { id } });
  assert.equal(run.status, "PENDING");
  assert.equal(run.cursor, 3);
  assert.equal(run.errorCode, "NETWORK");
  assert.equal(await db.userGameEntry.count({ where: { userId: user.id } }), 3);
  assert.equal(await db.game.count(), 3, "failed item must not leave an orphan canonical game");
  assert.ok(await db.userGameEntry.findUnique({ where: { userId_gameId_status: { userId: user.id, gameId: normalized.id, status: "OWNED" } } }));
  assert.equal(await queue.processBatch(id), false, "backoff must be respected");
  console.log("PASS duplicate clicks, access, canonical provider/title/IGDB matching and atomic rollback.");

  fail = false;
  await db.platformSyncRun.update({ where: { id }, data: { nextAttemptAt: new Date(0) } });
  // A new worker instance resumes persisted state with no initiating request/browser.
  const resumed = createSteamSyncQueue(providers);
  for (let batch = 0; batch < 30; batch++) {
    await resumed.processBatch(id);
    run = await db.platformSyncRun.findUniqueOrThrow({ where: { id } });
    console.log(`Checkpoint ${run.cursor}/${games.length} (${run.status}).`);
    if (run.status === "SUCCEEDED") break;
    assert.equal(run.status, "PENDING");
    assert.equal(run.errorCode, null);
  }
  assert.equal(run.status, "SUCCEEDED");
  assert.equal(run.cursor, games.length);
  assert.equal(run.totalCount, games.length);
  assert.equal(run.snapshot, null);
  assert.equal(fetches, 1, "resume must not fetch the library again");
  assert.equal(await db.userGameEntry.count({ where: { userId: user.id } }), games.length);
  assert.equal(await db.userGameProviderLink.count({ where: { userId: user.id } }), games.length);
  const entry = await db.userGameEntry.findUniqueOrThrow({ where: { userId_gameId_status: { userId: user.id, gameId: linked.id, status: "OWNED" } } });
  assert.equal(entry.playtimeMinutes, 777, "manual playtime must survive sync");
  assert.equal(await db.gameMetadataJob.count(), games.length);
  assert.ok((await db.externalAccount.findUniqueOrThrow({ where: { id: account.id } })).lastSyncedAt);
  console.log("PASS more than 100 titles, persisted continuation, deferred metadata and manual playtime.");

  const second = await queue.enqueue(user.id);
  if (second.kind !== "queued") throw new Error("No second job");
  const secondId = second.runId;
  await db.platformSyncRun.update({ where: { id: secondId }, data: {
    status: "RUNNING", workerToken: "dead-worker", leaseExpiresAt: new Date(Date.now() + 90_000),
    snapshot: { version: 1, games: [] }, totalCount: 0,
  } });
  assert.equal(await queue.processBatch(secondId), false, "active lease excludes overlapping workers");
  await db.platformSyncRun.update({ where: { id: secondId }, data: { leaseExpiresAt: new Date(0) } });
  await queue.processBatch(secondId);
  assert.equal((await db.platformSyncRun.findUniqueOrThrow({ where: { id: secondId } })).status, "SUCCEEDED");

  // Fencing: the original process returns after another worker took its lease.
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<void>(resolve => { started = resolve; });
  const slow = createSteamSyncQueue({ ...providers, fetchLibrary: async () => { started(); await waiting; return []; } });
  const third = await slow.enqueue(user.id);
  if (third.kind !== "queued") throw new Error("No third job");
  const running = slow.processBatch(third.runId);
  await ready;
  await db.platformSyncRun.update({ where: { id: third.runId }, data: { leaseExpiresAt: new Date(0) } });
  const winner = createSteamSyncQueue({ ...providers, fetchLibrary: async () => [] });
  await winner.processBatch(third.runId);
  release();
  await running;
  assert.equal((await db.platformSyncRun.findUniqueOrThrow({ where: { id: third.runId } })).status, "SUCCEEDED");
  console.log("PASS expired lease recovery and stale worker fencing.");

  const failure = createSteamSyncQueue({ ...providers, fetchLibrary: async () => { throw new Error("network failure"); } });
  const fourth = await failure.enqueue(user.id);
  if (fourth.kind !== "queued") throw new Error("No fourth job");
  for (let attempt = 1; attempt <= 5; attempt++) {
    await db.platformSyncRun.update({ where: { id: fourth.runId }, data: { nextAttemptAt: new Date(0) } });
    await failure.processBatch(fourth.runId);
    const state: PlatformSyncRun = await db.platformSyncRun.findUniqueOrThrow({ where: { id: fourth.runId } });
    assert.equal(state.attempt, attempt);
    assert.equal(state.status, attempt === 5 ? "FAILED" : "PENDING");
  }
  await db.platformSyncRun.update({ where: { id: fourth.runId }, data: {
    snapshot: { version: 1, games: games.map(game => ({ ...game, lastPlayedAt: game.lastPlayedAt?.toISOString() })) } as Prisma.InputJsonValue,
    cursor: 104, totalCount: 105, syncedCount: 104,
  } });
  const retry = await resumed.enqueue(user.id);
  if (retry.kind !== "queued") throw new Error("No retry");
  assert.equal((await db.platformSyncRun.findUniqueOrThrow({ where: { id: retry.runId } })).cursor, 104);
  await resumed.processBatch(retry.runId);
  assert.equal((await db.platformSyncRun.findUniqueOrThrow({ where: { id: retry.runId } })).status, "SUCCEEDED");
  assert.equal((await db.platformSyncRun.findUniqueOrThrow({ where: { id: fourth.runId } })).status, "FAILED", "preserve failure audit");
  console.log("PASS retry exhaustion and manual continuation without discarding audit history.");

  const disconnected = await queue.enqueue(user.id);
  if (disconnected.kind !== "queued") throw new Error("No pending disconnect job");
  await db.externalAccount.delete({ where: { id: account.id } });
  assert.equal(await queue.processBatch(disconnected.runId), false);
  console.log("PASS disconnect cancels queued work. All PostgreSQL queue checks passed.");
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());

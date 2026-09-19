import assert from "node:assert/strict";
import { prisma as db } from "../../src/lib/prisma";
import { createPlayStationSyncQueue } from "../../src/lib/playstation-sync-queue";
import { importPlayStationLibraryGame } from "../../src/lib/catalog";
import { igdbAdapter } from "../../src/lib/igdb";
import { getSyncWorkerScope } from "../../src/lib/steam-sync-state";
import type { SyncedLibraryGame } from "../../src/lib/providers/contracts";

async function main() {
  assert.match(new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "", /^steam_sync_test_[a-f0-9]{16}$/);
  process.env.CRON_SECRET = "fixture";
  process.env.PLATFORM_SYNC_ENABLED = "false";
  igdbAdapter.searchBestMatch = async () => null;
  const user = await db.user.create({ data: { plan: "FREE" } });
  const account = await db.externalAccount.create({ data: { userId: user.id, provider: "PLAYSTATION", providerAccountId: "ps-fixture" } });
  const games: SyncedLibraryGame[] = Array.from({ length: 105 }, (_, i) => ({
    providerGameId: `NPWR${i}_00`, providerGameIds: [`CUSA${i}`],
    title: `PS queue fixture ${i}`, platformName: "PS5", playtimeMinutes: 90,
    completionPercent: 25, lastPlayedAt: new Date("2026-09-01T12:00:00Z"),
  }));
  const canonical = await db.game.create({ data: { name: "Existing canonical", normalizedName: "existingcanonical", slug: "existing-canonical",
    providerLinks: { create: { provider: "PLAYSTATION", providerGameId: games[0].providerGameId } } } });
  await db.userGameEntry.create({ data: { userId: user.id, gameId: canonical.id, status: "DROPPED", statusChangedAt: new Date(),
    source: "MANUAL", platformName: "PS5", platformKey: "ps5", playtimeMinutes: 777, playtimeSource: "manual" } });
  let fetches = 0;
  const dependencies = { db, fetchLibrary: async () => {
    fetches++;
    return { profile: { providerAccountId: account.providerAccountId }, games };
  } };
  let fail = true;
  const queue = createPlayStationSyncQueue({ ...dependencies, importGame: async (owner, game, tx) => {
    await importPlayStationLibraryGame(owner, game, tx);
    if (fail && game.providerGameId === games[3].providerGameId) throw new Error("network interruption");
  } });
  assert.deepEqual(await queue.enqueue(user.id, "SCHEDULED"), { kind: "pro-required" });
  const [a,b] = await Promise.all([queue.enqueue(user.id), queue.enqueue(user.id)]);
  assert.deepEqual(a,b);
  assert.equal(a.kind,"queued");
  if(a.kind!=="queued") throw new Error("Missing run");
  await queue.processBatch(a.runId);
  let run = await db.platformSyncRun.findUniqueOrThrow({where:{id:a.runId}});
  assert.equal(run.cursor,3);
  assert.equal(run.status,"PENDING");
  assert.equal(await db.userGameEntry.count({where:{userId:user.id}}),3);
  assert.equal(await db.game.count(),3,"failed item must roll back canonical creation too");
  assert.equal(await queue.processBatch(a.runId),false,"provider backoff must be respected");
  fail = false;
  await db.platformSyncRun.update({where:{id:a.runId},data:{nextAttemptAt:new Date(0)}});
  const resumed = createPlayStationSyncQueue(dependencies);
  for(let i=0;i<30;i++) {
    await resumed.processBatch(a.runId);
    run=await db.platformSyncRun.findUniqueOrThrow({where:{id:a.runId}});
    if(run.status==="SUCCEEDED")break;
    assert.equal(run.status,"PENDING");
  }
  assert.equal(run.status,"SUCCEEDED");
  assert.equal(run.cursor,105);
  assert.equal(run.totalCount,105);
  assert.equal(fetches,1);
  assert.equal(await db.userGameEntry.count({where:{userId:user.id}}),105);
  const entry=await db.userGameEntry.findUniqueOrThrow({where:{userId_gameId_platformKey:{userId:user.id,gameId:canonical.id,platformKey:"ps5"}}});
  assert.equal(entry.status,"DROPPED");
  assert.equal(entry.playtimeMinutes,777);
  assert.equal(entry.pendingPlaytimeMinutes,90);
  assert.equal((await db.gameProviderLink.findUniqueOrThrow({where:{provider_providerGameId:{provider:"PLAYSTATION",providerGameId:"CUSA0"}}})).gameId,canonical.id);
  assert.equal(await db.userGameProviderLink.count({where:{userId:user.id}}),105);
  assert.equal(await db.gameMetadataJob.count(),105);
  console.log("PASS Free import of 105 games, atomic rollback, restart, aliases, manual status/hours and deferred metadata.");

  const legacyUser=await db.user.create({data:{plan:"FREE"}});
  const legacyAccount=await db.externalAccount.create({data:{userId:legacyUser.id,provider:"PLAYSTATION",providerAccountId:"legacy",
    lastSyncErrorCode:"LEASE_EXPIRED",nextSyncAt:new Date(0)}});
  await db.platformSyncRun.create({data:{externalAccountId:legacyAccount.id,provider:"PLAYSTATION",workerScope:getSyncWorkerScope(),
    trigger:"MANUAL",status:"FAILED",errorCode:"LEASE_EXPIRED"}});
  await Promise.all([resumed.recoverInterruptedManualRuns(),resumed.recoverInterruptedManualRuns()]);
  const legacyRun=await db.platformSyncRun.findFirstOrThrow({where:{externalAccountId:legacyAccount.id,status:"PENDING"}});
  assert.equal(await db.platformSyncRun.count({where:{externalAccountId:legacyAccount.id,status:"PENDING"}}),1);
  const empty=createPlayStationSyncQueue({db,fetchLibrary:async()=>({profile:{providerAccountId:"legacy"},games:[]})});
  await empty.processBatch(legacyRun.id);
  assert.equal((await db.platformSyncRun.findUniqueOrThrow({where:{id:legacyRun.id}})).status,"SUCCEEDED");
  await empty.recoverInterruptedManualRuns();
  assert.equal(await db.platformSyncRun.count({where:{externalAccountId:legacyAccount.id}}),2);
  console.log("PASS legacy manual retry on Free without enabling Pro periodic refreshes or duplicating recovery.");

  const fresh=await resumed.enqueue(user.id);
  if(fresh.kind!=="queued")throw new Error("Missing run");
  let release!:()=>void;
  let entered!:()=>void;
  const blocked=new Promise<void>(resolve=>{release=resolve;});
  const claimed=new Promise<void>(resolve=>{entered=resolve;});
  const slow=createPlayStationSyncQueue({db,fetchLibrary:async()=>{
    entered();await blocked;return {profile:{providerAccountId:"fixture"},games:[games[0]]};
  }});
  const work=slow.processBatch(fresh.runId);
  await claimed;
  assert.equal(await resumed.processBatch(fresh.runId),false,"a concurrent worker cannot steal a live lease");
  await db.platformSyncRun.update({where:{id:fresh.runId},data:{leaseExpiresAt:new Date(0)}});
  await empty.processBatch(fresh.runId);
  release();
  await work;
  run=await db.platformSyncRun.findUniqueOrThrow({where:{id:fresh.runId}});
  assert.equal(run.status,"SUCCEEDED");
  assert.equal(run.cursor,0,"the expired worker cannot commit after another worker completed");
  console.log("PASS exclusive lease and fencing of late workers.");

  await db.user.update({where:{id:user.id},data:{plan:"PRO"}});
  const scheduled=await resumed.enqueue(user.id,"SCHEDULED");
  if(scheduled.kind!=="queued")throw new Error("Missing scheduled run");
  await db.user.update({where:{id:user.id},data:{plan:"FREE"}});
  await empty.processBatch(scheduled.runId);
  assert.equal((await db.platformSyncRun.findUniqueOrThrow({where:{id:scheduled.runId}})).errorCode,"PRO_REQUIRED");
  const other=await db.user.create({data:{}});
  assert.deepEqual(await resumed.enqueue(other.id),{kind:"not-connected"});
  console.log("PASS entitlement recheck and disconnected-user isolation. No provider requests.");
}

main().finally(()=>db.$disconnect()).catch(error=>{console.error(error);process.exitCode=1;});

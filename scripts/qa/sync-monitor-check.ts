import assert from "node:assert/strict";
import type { ExternalProvider } from "@prisma/client";
import { prisma as db } from "../../src/lib/prisma";
import { createSyncIncidentMonitor } from "../../src/lib/sync-incident-monitor";

async function main() {
  assert.match(new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "", /^steam_sync_test_[a-f0-9]{16}$/);
  let clock = new Date();
  const at = () => clock;
  const deliveries: string[] = [];
  let mailFails = false;
  const sendEmail = async ({ id }: { id: string }) => {
    if (mailFails) throw new Error("simulated mail outage");
    deliveries.push(id);
    return { sent: true as const, id: `test-${id}` };
  };
  const monitor = createSyncIncidentMonitor({ db, scope: "production", now: at, sendEmail });
  async function account(provider: ExternalProvider, key: string, scope = "production") {
    const user = await db.user.create({ data: { displayName: `Fixture ${key}` } });
    const source = await db.externalAccount.create({ data: { userId: user.id, provider, providerAccountId: key } });
    const run = await db.platformSyncRun.create({ data: {
      externalAccountId: source.id, provider, workerScope: scope, trigger: "MANUAL", status: "FAILED",
      errorCode: provider === "STEAM" ? "CONFIGURATION" : "AUTH", finishedAt: clock, totalCount: 500, cursor: 50,
    } });
    return { source, run };
  }
  const a = await account("STEAM", "a");
  const b = await account("STEAM", "b");
  const local = await account("STEAM", "local", "development");
  const localMonitor = createSyncIncidentMonitor({ db, scope: "development", now: at, sendEmail });
  await localMonitor.scan();
  assert.equal(await db.feedback.count(), 0);
  const scans = await Promise.all([monitor.scan(), monitor.scan()]);
  assert.equal(scans.filter(result => result.accepted).length, 1);
  const global = await db.syncIncident.findFirstOrThrow({ include: { members: true, feedback: true } });
  assert.equal(await db.syncIncident.count(), 1);
  assert.equal(global.members.length, 2);
  assert.ok(global.members.every(member => member.externalAccountId !== local.source.id));
  assert.equal(global.feedback.userId, null, "automatic incidents are admin-only");
  assert.equal(deliveries.length, 1);
  const comments = await db.feedbackComment.count();
  await monitor.scan();
  assert.equal(await db.feedbackComment.count(), comments, "unchanged errors do not spam comments");
  assert.equal(deliveries.length, 1, "unchanged incident does not resend email");
  console.log("PASS production isolation, concurrent scans, shared incident and email deduplication.");

  await db.platformSyncRun.update({ where: { id: a.run.id }, data: { status: "SUCCEEDED", errorCode: null } });
  await monitor.scan();
  assert.equal((await db.syncIncident.findUniqueOrThrow({ where: { id: global.id } })).recoveredAt, null);
  await db.platformSyncRun.update({ where: { id: b.run.id }, data: { status: "SUCCEEDED", errorCode: null } });
  await monitor.scan();
  assert.ok((await db.syncIncident.findUniqueOrThrow({ where: { id: global.id } })).recoveredAt);
  assert.equal((await db.feedback.findUniqueOrThrow({ where: { id: global.feedbackId } })).status, "NEW", "only admin closes");
  assert.equal(deliveries.length, 1);
  console.log("PASS partial/full recovery without automatic closure or extra email.");

  const individual = await account("XBOX", "x");
  mailFails = true;
  await monitor.scan();
  const incident = await db.syncIncident.findFirstOrThrow({ where: { provider: "XBOX" } });
  assert.equal(incident.emailSentAt, null);
  assert.equal(incident.emailLastError, "DELIVERY_FAILED");
  assert.equal(await db.syncIncident.count(), 2);
  mailFails = false;
  clock = new Date(clock.getTime() + 16 * 60_000);
  await monitor.scan();
  assert.ok((await db.syncIncident.findUniqueOrThrow({ where: { id: incident.id } })).emailSentAt);
  assert.equal(deliveries.length, 2);
  await db.feedback.update({ where: { id: incident.feedbackId }, data: { status: "DONE" } });
  await monitor.scan();
  assert.equal(await db.syncIncident.count(), 2, "closed same failure stays acknowledged");
  await db.platformSyncRun.create({ data: {
    externalAccountId: individual.source.id, provider: "XBOX", trigger: "MANUAL", workerScope: "production",
    status: "FAILED", errorCode: "AUTH", createdAt: clock,
  } });
  await monitor.scan();
  assert.equal(await db.syncIncident.count(), 3, "new failed run after closure opens a new incident");
  assert.equal(deliveries.length, 3);
  console.log("PASS email retry, manual acknowledgement and recurrence.");

  await db.externalAccount.delete({ where: { id: individual.source.id } });
  await monitor.scan();
  const recurring = await db.syncIncident.findFirstOrThrow({ where: { provider: "XBOX", feedback: { status: "NEW" } }, include: { members: true } });
  assert.equal(recurring.members[0].state, "DISCONNECTED");
  assert.ok(recurring.recoveredAt);
  const stalled = await account("STEAM", "stalled");
  await db.platformSyncRun.update({ where: { id: stalled.run.id }, data: {
    status: "RUNNING", errorCode: null, startedAt: new Date(clock.getTime() - 16 * 60_000),
    lastProgressAt: new Date(clock.getTime() - 16 * 60_000), nextAttemptAt: clock,
  } });
  await monitor.scan();
  const stalledMember = await db.syncIncidentMember.findFirstOrThrow({ where: { externalAccountId: stalled.source.id } });
  assert.equal(stalledMember.state, "STALLED");
  await db.platformSyncRun.update({ where: { id: stalled.run.id }, data: { cursor: 51, lastProgressAt: clock } });
  await monitor.scan();
  assert.equal((await db.syncIncidentMember.findFirstOrThrow({ where: { externalAccountId: stalled.source.id } })).state, "RETRYING");
  console.log("PASS disconnect, stuck worker detection and resumed progress. No real email sent.");
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());

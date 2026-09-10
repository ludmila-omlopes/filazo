import { randomUUID } from "node:crypto";
import { type Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendSyncIncidentEmail } from "@/lib/email";
import { getSyncWorkerScope } from "@/lib/steam-sync-state";
import { CLOSED_FEEDBACK_STATUSES, getSyncHealth, getSyncIncidentKey, SYNC_MONITOR_ID, syncIncidentStateText } from "@/lib/sync-incident-policy";

const openFeedback = { status: { notIn: [...CLOSED_FEEDBACK_STATUSES] } };
const accountInclude = {
  user: { select: { displayName: true } },
  platformSyncRuns: {
    where: { workerScope: "production", status: { not: "SKIPPED" as const } },
    orderBy: { createdAt: "desc" as const }, take: 1,
  },
} satisfies Prisma.ExternalAccountInclude;
type Account = Prisma.ExternalAccountGetPayload<{ include: typeof accountInclude }>;

export function createSyncIncidentMonitor({
  db = prisma, sendEmail = sendSyncIncidentEmail, scope = getSyncWorkerScope(),
  now = () => new Date(),
}: {
  db?: PrismaClient;
  sendEmail?: typeof sendSyncIncidentEmail;
  scope?: string;
  now?: () => Date;
} = {}) {
  async function scan() {
    if (scope !== "production") return { accepted: false, reason: "environment" };
    const deadline = Date.now() + 40_000;
    const token = randomUUID();
    await db.platformSyncSchedulerState.createMany({
      data: [{ id: SYNC_MONITOR_ID }], skipDuplicates: true,
    });
    const claimed = await db.platformSyncSchedulerState.updateMany({
      where: { id: SYNC_MONITOR_ID, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now() } }] },
      data: { leaseToken: token, leaseExpiresAt: new Date(now().getTime() + 90_000) },
    });
    if (!claimed.count) return { accepted: false, reason: "busy" };

    async function fence(tx: Prisma.TransactionClient) {
      const held = await tx.platformSyncSchedulerState.updateMany({
        where: { id: SYNC_MONITOR_ID, leaseToken: token, leaseExpiresAt: { gt: now() } },
        data: { updatedAt: now() },
      });
      if (!held.count) throw new Error("Sync monitor lease expired.");
    }
    async function summarize(tx: Prisma.TransactionClient, incidentId: string) {
      const incident = await tx.syncIncident.findUniqueOrThrow({
        where: { id: incidentId }, include: { members: true },
      });
      const remaining = incident.members.filter(member => !["RECOVERED", "DISCONNECTED"].includes(member.state));
      const recoveredAt = remaining.length ? null : incident.recoveredAt ?? now();
      await tx.syncIncident.update({ where: { id: incidentId }, data: { recoveredAt } });
      await tx.feedback.update({ where: { id: incident.feedbackId }, data: {
        details: `Incidente automático de sincronização ${incident.provider}. ${incident.members.length} conta(s) registrada(s); ${remaining.length} ainda precisam de atenção. ${recoveredAt ? "Recuperação registrada. Aguardando fechamento pelo administrador." : "O monitor acompanha as tentativas e o progresso."} Consulte as pessoas afetadas e o histórico em /admin/sync.`,
      } });
    }
    async function record(account: Account) {
      const run = account.platformSyncRuns[0];
      if (!run) return;
      const state = getSyncHealth(run, now());
      if (!state) return;
      const problematic = state === "FAILED" || state === "STALLED";
      const incidentKey = getSyncIncidentKey(run);
      // Healthy accounts with no incident need no writes.
      const memberships = await db.syncIncidentMember.findMany({ where: {
        externalAccountId: account.id, incident: { feedback: openFeedback },
      }, select: { incidentId: true } });
      if (!problematic && !memberships.length) return;
      await db.$transaction(async tx => {
        await fence(tx);
        await tx.syncIncident.updateMany({ where: { activeKey: incidentKey, feedback: { status: { in: [...CLOSED_FEEDBACK_STATUSES] } } }, data: { activeKey: null } });
        if (!memberships.length && problematic) {
          // Closing a ticket acknowledges the runs it contains. Do not recreate
          // it every minute for the same failure; a new failed run can recur.
          const acknowledged = await tx.syncIncidentMember.findFirst({ where: {
            externalAccountId: account.id, runId: run.id,
            incident: { key: incidentKey, feedback: { status: { in: [...CLOSED_FEEDBACK_STATUSES] } } },
          } });
          if (acknowledged) return;
        }
        let incident = memberships[0]
          ? await tx.syncIncident.findUnique({ where: { id: memberships[0].incidentId } })
          : await tx.syncIncident.findUnique({ where: { activeKey: incidentKey } });
        if (!incident && problematic) {
          const shared = incidentKey.endsWith("shared-credentials");
          incident = await tx.syncIncident.create({ data: {
            key: incidentKey, activeKey: incidentKey, provider: run.provider, emailNextAttemptAt: now(),
            feedback: { create: {
              type: "BUG", title: shared ? "Steam: falha geral de acesso à API" : `${run.provider}: falha na sincronização de biblioteca`,
              details: "Incidente automático de sincronização. Aguardando diagnóstico do monitor.",
            } },
          } });
        }
        if (!incident) return;
        // Lock the feedback status through the update, without ever reopening it.
        const writable = await tx.feedback.updateMany({ where: { id: incident.feedbackId, ...openFeedback }, data: { updatedAt: now() } });
        if (!writable.count) return;
        const where = { incidentId_externalAccountId: { incidentId: incident.id, externalAccountId: account.id } };
        const before = await tx.syncIncidentMember.findUnique({ where });
        const userLabel = account.user.displayName || account.displayName || account.username || `Conta ${account.id}`;
        const data = {
          accountId: account.id, runId: run.id, userLabel, state,
          errorCode: run.errorCode, progress: run.totalCount !== null ? run.cursor : run.syncedCount,
          totalCount: run.totalCount,
        };
        await tx.syncIncidentMember.upsert({ where, create: { incidentId: incident.id, externalAccountId: account.id, ...data }, update: data });
        // Store milestones, not one comment for every processed game.
        if (!before || before.runId !== run.id || before.state !== state || before.errorCode !== run.errorCode) {
          const progress = data.progress !== null ? ` Progresso: ${data.progress}${data.totalCount !== null ? `/${data.totalCount}` : ""}.` : "";
          await tx.feedbackComment.create({ data: {
            feedbackId: incident.feedbackId, isSystem: true,
            body: `${userLabel} · ${syncIncidentStateText(state)}.${run.errorCode ? ` Código: ${run.errorCode}.` : ""}${progress} Execução: ${run.id}.`,
          } });
        }
        await summarize(tx, incident.id);
      }, { timeout: 15_000 });
    }

    let inspected = 0;
    try {
      const scheduler = await db.platformSyncSchedulerState.findUniqueOrThrow({ where: { id: SYNC_MONITOR_ID } });
      const accounts = await db.externalAccount.findMany({
        where: { ...(scheduler.scanCursor ? { id: { gt: scheduler.scanCursor } } : {}), platformSyncRuns: { some: { workerScope: "production" } } },
        include: accountInclude, orderBy: { id: "asc" }, take: 100,
      });
      for (const account of accounts) {
        if (Date.now() >= deadline - 12_000) break;
        await record(account);
        inspected++;
        await db.platformSyncSchedulerState.updateMany({ where: { id: SYNC_MONITOR_ID, leaseToken: token }, data: { scanCursor: account.id } });
      }
      if (inspected === accounts.length && accounts.length < 100) {
        await db.platformSyncSchedulerState.updateMany({ where: { id: SYNC_MONITOR_ID, leaseToken: token }, data: { scanCursor: null } });
      }
      const disconnected = await db.syncIncidentMember.findMany({
        where: { accountId: null, state: { not: "DISCONNECTED" }, incident: { feedback: openFeedback } }, take: 20,
      });
      for (const member of disconnected) {
        if (Date.now() >= deadline - 12_000) break;
        await db.$transaction(async tx => {
          await fence(tx);
          const incident = await tx.syncIncident.findUniqueOrThrow({ where: { id: member.incidentId } });
          const writable = await tx.feedback.updateMany({ where: { id: incident.feedbackId, ...openFeedback }, data: { updatedAt: now() } });
          if (!writable.count) return;
          await tx.syncIncidentMember.update({ where: { incidentId_externalAccountId: { incidentId: member.incidentId, externalAccountId: member.externalAccountId } }, data: { state: "DISCONNECTED" } });
          await tx.feedbackComment.create({ data: { feedbackId: incident.feedbackId, isSystem: true, body: `${member.userLabel} · Conta desconectada. O chamado permanece disponível para fechamento manual.` } });
          await summarize(tx, incident.id);
        });
      }
      const pendingEmails = await db.syncIncident.findMany({
        where: { emailSentAt: null, emailNextAttemptAt: { lte: now() }, feedback: openFeedback },
        orderBy: { emailNextAttemptAt: "asc" }, take: 5,
      });
      for (const incident of pendingEmails) {
        if (Date.now() >= deadline) break;
        await db.$transaction(fence);
        let error: string | null = null;
        try {
          const result = await sendEmail(incident);
          if (!result.sent) error = "CONFIGURATION";
        } catch { error = "DELIVERY_FAILED"; }
        await db.$transaction(async tx => {
          await fence(tx);
          await tx.syncIncident.update({ where: { id: incident.id }, data: {
            emailAttempts: { increment: 1 }, emailLastError: error,
            ...(error ? { emailNextAttemptAt: new Date(now().getTime() + Math.min(360, 15 * 2 ** Math.min(incident.emailAttempts, 5)) * 60_000) } : { emailSentAt: now() }),
          } });
        });
      }
      await db.platformSyncSchedulerState.updateMany({
        where: { id: SYNC_MONITOR_ID, leaseToken: token }, data: { lastTriggeredAt: now() },
      });
      return { accepted: true, inspected };
    } finally {
      await db.platformSyncSchedulerState.updateMany({ where: { id: SYNC_MONITOR_ID, leaseToken: token }, data: { leaseToken: null, leaseExpiresAt: null } });
    }
  }
  return { scan };
}

export const syncIncidentMonitor = createSyncIncidentMonitor();

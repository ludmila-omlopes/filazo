import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AdminNav } from "../admin-nav";
import { Notice } from "@/components/ui/notice";
import { getSessionUserWithBeta, isAdminEmail } from "@/lib/beta-access";
import { getSessionUserId } from "@/lib/session";
import { getRequestLocale } from "@/lib/request-locale";
import { createTranslator, type TranslationKey } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { CLOSED_FEEDBACK_STATUSES, getSyncHealth, SYNC_MONITOR_ID } from "@/lib/sync-incident-policy";
import { SyncMonitorRefresh } from "./refresh";

const filters = ["all", "active", "failed", "recovered"] as const;
const stateKeys: Record<string, TranslationKey> = {
  PENDING: "admin.sync.pending", RUNNING: "admin.sync.running", FAILED: "admin.sync.failed",
  STALLED: "admin.sync.stalled", SUCCEEDED: "admin.sync.succeeded", RECOVERED: "admin.sync.recovered",
  RETRYING: "admin.sync.retrying", DISCONNECTED: "admin.sync.disconnected",
};

export default async function AdminSyncPage({ searchParams }: {
  searchParams: Promise<{ view?: string }>;
}) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const admin = await getSessionUserWithBeta(await getSessionUserId());
  if (!admin || !isAdminEmail(admin.email)) {
    return <main id="main-content"><Notice tone="error">{t("admin.restricted")}</Notice></main>;
  }
  const query = await searchParams;
  const view = filters.find(value => value === query.view) ?? "all";
  const now = new Date();
  const [incidents, monitor, recovered] = await Promise.all([
    prisma.syncIncident.findMany({
      where: { feedback: { status: { notIn: [...CLOSED_FEEDBACK_STATUSES] } } },
      include: { feedback: { select: { title: true } }, members: { orderBy: { updatedAt: "desc" } } },
      orderBy: { createdAt: "desc" }, take: 50,
    }),
    prisma.platformSyncSchedulerState.findUnique({ where: { id: SYNC_MONITOR_ID } }),
    view === "recovered" ? prisma.syncIncidentMember.findMany({ where: { state: "RECOVERED" }, select: { runId: true }, take: 1000, orderBy: { updatedAt: "desc" } }) : Promise.resolve([]),
  ]);
  const where: Prisma.PlatformSyncRunWhereInput = {
    workerScope: "production", status: { not: "SKIPPED" },
    ...(view === "active" ? { status: { in: ["PENDING", "RUNNING"] } } : {}),
    ...(view === "failed" ? { status: "FAILED" } : {}),
    ...(view === "recovered" ? { id: { in: recovered.map(member => member.runId) } } : {}),
  };
  const runs = await prisma.platformSyncRun.findMany({
    where, orderBy: { createdAt: "desc" }, take: 100,
    include: { externalAccount: { select: { username: true, user: { select: { displayName: true } } } } },
  });
  const format = (date: Date | null) => date?.toLocaleString(locale) ?? "—";
  const label = (state: string) => stateKeys[state] ? t(stateKeys[state]) : state;
  const staleMonitor = !monitor?.lastTriggeredAt || now.getTime() - monitor.lastTriggeredAt.getTime() > 5 * 60_000;
  return (
    <main id="main-content" className="mx-auto grid w-full max-w-[1280px] gap-8">
      <SyncMonitorRefresh />
      <section className="grid gap-4">
        <AdminNav current="/admin/sync" locale={locale} />
        <h1 className="text-page-title">{t("admin.nav.sync")}</h1>
        <p className="max-w-[70ch] text-ink-soft">{t("admin.sync.description")}</p>
        <p className="text-xs text-ink-soft">{t("admin.sync.lastScan", { date: format(monitor?.lastTriggeredAt ?? null) })}</p>
        {staleMonitor ? <Notice tone="warning">{t("admin.sync.monitorStale")}</Notice> : null}
      </section>
      <section className="grid gap-4">
        <h2 className="font-display text-2xl">{t("admin.sync.incidents")}</h2>
        <p className="text-sm text-ink-soft">{t("admin.sync.incidentHelp")}</p>
        {incidents.length ? incidents.map(incident => (
          <article key={incident.id} className="grid gap-3 rounded-card border border-edge bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold"><Link className="underline underline-offset-4" href={`/admin/feedback#feedback-${incident.feedbackId}`}>{incident.feedback.title}</Link></h3>
              <span className="text-sm">{incident.recoveredAt ? t("admin.sync.recoveredAwaitingClose") : t("admin.sync.needsAttention")}</span>
            </div>
            <p className="text-xs text-ink-soft">{incident.emailSentAt ? t("admin.sync.emailSent", { date: format(incident.emailSentAt) }) : incident.emailLastError ? t("admin.sync.emailFailed") : t("admin.sync.emailPending")}</p>
            <details>
              <summary className="cursor-pointer text-sm font-semibold">{t("admin.sync.affected")}</summary>
              <ul className="mt-3 grid gap-3">
                {incident.members.map(member => (
                  <li key={member.externalAccountId} className="border-t border-edge pt-3 text-sm">
                    <p className="font-semibold">{member.userLabel} · {label(member.state)}</p>
                    <p className="text-ink-soft">{t("admin.sync.progress")}: {member.progress ?? "—"}{member.totalCount !== null ? `/${member.totalCount}` : ""}{member.errorCode ? ` · ${member.errorCode}` : ""}</p>
                    <p className="break-all text-xs text-ink-soft">{t("admin.sync.run")}: {member.runId}</p>
                  </li>
                ))}
              </ul>
            </details>
          </article>
        )) : <Notice tone="info">{t("admin.sync.noIncidents")}</Notice>}
      </section>
      <section className="grid gap-4">
        <h2 className="font-display text-2xl">{t("admin.sync.runs")}</h2>
        <nav aria-label={t("admin.sync.filters")} className="flex flex-wrap gap-2">
          {filters.map(filter => <Link key={filter} href={`/admin/sync?view=${filter}`} aria-current={view === filter ? "page" : undefined} className={`rounded-pill border px-4 py-2 text-sm font-semibold ${view === filter ? "border-ink bg-ink text-canvas" : "border-edge bg-surface"}`}>{t(`admin.sync.filter.${filter}`)}</Link>)}
        </nav>
        {runs.length ? <div className="overflow-x-auto rounded-card border border-edge bg-surface">
          <table className="w-full min-w-[700px] text-left text-sm">
            <caption className="p-4 text-left text-xs text-ink-soft">{t("admin.sync.limit")}</caption>
            <thead><tr>{["user", "provider", "status", "progress", "updated", "error"].map(key => <th scope="col" className="border-b border-edge p-3" key={key}>{t(`admin.sync.${key}` as TranslationKey)}</th>)}</tr></thead>
            <tbody>{runs.map(run => {
              const health = getSyncHealth(run, now);
              return <tr key={run.id}>
                <td className="border-b border-edge p-3">{run.externalAccount.user.displayName ?? run.externalAccount.username ?? t("admin.noName")}</td>
                <td className="border-b border-edge p-3">{run.provider}</td>
                <td className="border-b border-edge p-3">{label(health === "STALLED" ? health : run.status)}</td>
                <td className="border-b border-edge p-3">{run.totalCount !== null ? `${run.cursor}/${run.totalCount}` : run.syncedCount ?? "—"}</td>
                <td className="border-b border-edge p-3">{format(run.lastProgressAt ?? run.finishedAt ?? run.startedAt ?? run.createdAt)}</td>
                <td className="border-b border-edge p-3">{run.errorCode ?? "—"}<details className="mt-1"><summary className="cursor-pointer text-xs">{t("admin.sync.details")}</summary><p className="mt-2 break-all text-xs">{run.id}</p><p className="mt-2">{run.errorMessage}</p><p className="mt-2">{t("admin.sync.attempts", { count: String(run.attempt) })}</p></details></td>
              </tr>;
            })}</tbody>
          </table>
        </div> : <Notice tone="info">{t("admin.sync.noRuns")}</Notice>}
      </section>
    </main>
  );
}

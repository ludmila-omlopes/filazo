import Link from "next/link";
import { BetaTesterStatus } from "@prisma/client";
import { ArrowLeft, Clock3 } from "lucide-react";
import { Notice } from "@/components/ui/notice";
import { getSessionUserWithBeta, isAdminEmail } from "@/lib/beta-access";
import { createTranslator } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";

function latestDate(dates: Array<Date | null | undefined>) {
  return dates.filter((date): date is Date => Boolean(date)).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

export default async function AdminActivityPage() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const admin = await getSessionUserWithBeta(await getSessionUserId());
  if (!admin || !isAdminEmail(admin.email)) {
    return <main id="main-content" className="mx-auto max-w-4xl"><Notice tone="error">{t("admin.restricted")}</Notice></main>;
  }

  const testers = await prisma.betaTesterApplication.findMany({
    where: { status: BetaTesterStatus.APPROVED },
    orderBy: { reviewedAt: "desc" },
    include: { user: { select: {
      id: true, displayName: true, email: true, createdAt: true, updatedAt: true,
      externalAccounts: { select: { provider: true, lastSyncedAt: true, updatedAt: true } },
      importJobs: { orderBy: { createdAt: "desc" }, take: 3, select: { id: true, fileName: true, status: true, createdAt: true, completedAt: true } },
      gameEntries: { orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, status: true, source: true, createdAt: true, updatedAt: true, lastPlayedAt: true, game: { select: { name: true, slug: true } } } },
      journalEntries: { orderBy: { occurredAt: "desc" }, take: 3, select: { id: true, occurredAt: true, game: { select: { name: true } } } },
    } } },
  });

  const format = (date: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
  return <main id="main-content" className="mx-auto grid w-full max-w-[1180px] gap-7">
    <header>
      <Link className="inline-flex items-center gap-2 text-sm font-bold text-ink-soft hover:text-ink" href="/admin"><ArrowLeft className="size-4" />{t("admin.activity.back")}</Link>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">{t("admin.activity.kicker")}</p>
      <h1 className="mt-2 font-display text-4xl font-medium">{t("admin.activity.title")}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{t("admin.activity.body")}</p>
    </header>
    <div className="grid gap-5">
      {testers.map(({ user }) => {
        const latest = latestDate([user.updatedAt, ...user.externalAccounts.flatMap((a) => [a.lastSyncedAt, a.updatedAt]), ...user.importJobs.flatMap((j) => [j.completedAt, j.createdAt]), ...user.gameEntries.flatMap((e) => [e.updatedAt, e.lastPlayedAt]), ...user.journalEntries.map((e) => e.occurredAt)]);
        return <article className="rounded-card border border-edge bg-surface p-5 shadow-rest" key={user.id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl">{user.displayName ?? t("admin.noName")}</h2><p className="text-sm text-ink-soft">{user.email ?? t("admin.noEmail")}</p></div>{latest ? <p className="flex items-center gap-2 text-xs font-bold text-ink-soft"><Clock3 className="size-4" />{t("admin.activity.latest", { date: format(latest) })}</p> : null}</div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <ActivityList title={t("admin.activity.syncs")} empty={t("admin.activity.noSyncs")} items={user.externalAccounts.filter((a) => a.lastSyncedAt).map((a) => `${a.provider} · ${format(a.lastSyncedAt!)}`)} />
            <ActivityList title={t("admin.activity.imports")} empty={t("admin.activity.noImports")} items={user.importJobs.map((j) => `${j.fileName} · ${j.status} · ${format(j.completedAt ?? j.createdAt)}`)} />
            <ActivityList title={t("admin.activity.library")} empty={t("admin.activity.noLibrary")} items={user.gameEntries.map((e) => `${e.game.name} · ${e.status} · ${format(e.updatedAt)}`)} />
          </div>
          <Link className="mt-5 inline-flex text-sm font-bold underline decoration-ink/30 underline-offset-4" href={`/profile?viewAs=${user.id}`}>{t("admin.preview.open")}</Link>
        </article>;
      })}
      {!testers.length ? <Notice tone="info">{t("admin.activity.empty")}</Notice> : null}
    </div>
  </main>;
}

function ActivityList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <section><h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">{title}</h3><ul className="mt-2 grid gap-2 text-sm">{items.length ? items.map((item) => <li className="border-l-2 border-edge pl-3" key={item}>{item}</li>) : <li className="text-ink-soft">{empty}</li>}</ul></section>;
}

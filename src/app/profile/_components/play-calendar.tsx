import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";
import { calendarCopy } from "@/lib/calendar-copy";
import { readCalendar } from "@/lib/calendar";
import { calendarMonth as parseMonth, DAY_MS, isCalendarEstimateCurrent, utcDay, type EstimateReason } from "@/lib/calendar-policy";
import { refreshCalendarAction, saveCalendarMinutesAction, saveCalendarStartAction, setCalendarReleaseAction } from "../calendar-actions";
import { CalendarSubmit } from "./calendar-submit";
import type { ProfileData } from "./profile-types";

const panel = "rounded-card border border-edge bg-surface p-5 sm:p-6";
const inputStyle = "min-h-11 w-full min-w-0 rounded-inner border border-edge bg-canvas px-3 text-sm";
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
type CalendarProps = { calendarMonth?: string; calendarStatus?: string; locale: Locale; profile: ProfileData; viewAsUserId?: string | null };

export async function PlayCalendar(props: CalendarProps) {
  let data: Awaited<ReturnType<typeof readCalendar>>;
  try { data = await readCalendar(props.profile.user.id); }
  catch { return <p role="alert" className={panel}>{calendarCopy(props.locale).loadFailed}</p>; }
  return <CalendarView {...props} data={data} />;
}

export function CalendarView({ calendarMonth, calendarStatus, locale, profile, viewAsUserId, data }: CalendarProps & { data: Awaited<ReturnType<typeof readCalendar>> }) {
  const c = calendarCopy(locale);
  const now = new Date();
  const month = parseMonth(calendarMonth, now);
  const end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  const format = (date: Date) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  const readOnly = Boolean(viewAsUserId);
  const manualUsed = Boolean(data.state?.manualAt && data.state.manualAt >= utcDay(now));
  const updates = [data.state?.automaticAt, data.state?.manualAt].filter((value): value is Date => Boolean(value)).sort((a, b) => b.getTime() - a.getTime());
  const href = (offset: number) => {
    const target = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + offset, 1));
    const params = new URLSearchParams({ tab: "calendar", month: dateKey(target).slice(0, 7) });
    if (viewAsUserId) params.set("viewAs", viewAsUserId);
    return `/profile?${params}`;
  };
  const savedIds = new Set(data.saved.map((item) => item.releaseId));
  const activeEntries = data.entries.filter((entry) => !entry.finishedAt && entry.status !== "COMPLETED" && entry.status !== "DROPPED" && entry.activeBacklog);
  const events: { id: string; date: Date; title: string; kind: string; href?: string; extra?: string }[] = [];
  for (const entry of data.entries) {
    const gameHref = `/games/${entry.game.slug}`;
    if (entry.manualStartedAt) events.push({ id: `${entry.id}-start`, date: entry.manualStartedAt, title: entry.game.name, kind: c.began, href: gameHref });
    if (entry.finishedAt) events.push({ id: `${entry.id}-finish`, date: entry.finishedAt, title: entry.game.name, kind: c.actualFinish, href: gameHref });
    else if (entry.calendarEstimate?.estimatedFinish && isCalendarEstimateCurrent(entry.calendarEstimate, now) && entry.status !== "COMPLETED" && entry.status !== "DROPPED" && entry.activeBacklog) events.push({ id: `${entry.id}-estimate`, date: entry.calendarEstimate.estimatedFinish, title: entry.game.name, kind: c.estimated, href: gameHref });
  }
  for (const { release } of data.saved) {
    if (release.releaseDate) events.push({ id: release.id, date: release.releaseDate, title: release.game.name, kind: c.release, extra: `${release.platform} · ${release.region}` });
  }
  const visible = events.filter((event) => event.date >= month && event.date < end).sort((a, b) => a.date.getTime() - b.date.getTime());
  const notices = { refreshed: c.refreshed, saved: c.saved, limited: c.limited, failed: c.failed, invalid: c.invalid };
  const notice = calendarStatus && Object.hasOwn(notices, calendarStatus) ? notices[calendarStatus as keyof typeof notices] : null;

  return <section className="grid min-w-0 gap-7">
    <header className="grid gap-3">
      <h2 className="font-display text-3xl font-medium">{c.title}</h2>
      <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">{c.body}</p>
      {readOnly ? <p className="text-sm text-ink-soft">{c.preview}</p> : null}
      {notice ? <p className="rounded-inner border border-edge bg-canvas p-3 text-sm" role="status">{notice}</p> : null}
    </header>
    <section className={panel} aria-labelledby="calendar-pace">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="font-display text-xl" id="calendar-pace">{c.playing}</h3>
        {!readOnly ? <form action={refreshCalendarAction}><CalendarSubmit disabled={manualUsed}>{manualUsed ? c.limit : c.update}</CalendarSubmit></form> : null}
      </div>
      <p className="mt-3 max-w-2xl text-xs leading-relaxed text-ink-soft">{c.daily}</p>
      <p className="mt-1 text-xs text-ink-soft">{updates[0] ? `${c.updated}: ${format(updates[0])}` : c.notUpdated}</p>
      <div className="mt-5 divide-y divide-edge">
        {activeEntries.map((entry) => {
          const forecast = entry.calendarEstimate;
          const reason = entry.finishedAt || entry.status === "COMPLETED" ? "completed" : entry.status === "DROPPED" || !entry.activeBacklog ? "paused" : !entry.manualStartedAt ? "missing_start" : forecast && !isCalendarEstimateCurrent(forecast, now) ? "outdated" : forecast?.reason ?? "learning";
          const reasonText = c[reason as EstimateReason | "outdated"] ?? c.learning;
          const finish = reason === "ready" ? forecast?.estimatedFinish : null;
          return <article key={entry.id} className="grid gap-3 py-5 first:pt-0 last:pb-0">
            <Link href={`/games/${entry.game.slug}`} className="w-fit break-words font-display text-lg font-medium underline-offset-4 hover:underline">{entry.game.name}</Link>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-soft">{c.start}</dt><dd className="mt-1 font-semibold">{entry.manualStartedAt ? format(entry.manualStartedAt) : c.startMissing}</dd></div>
              <div><dt className="text-ink-soft">{entry.finishedAt ? c.actualFinish : c.finish}</dt><dd className="mt-1 font-semibold">{entry.finishedAt ? format(entry.finishedAt) : finish ? `${c.around} ${format(finish)}` : "—"}</dd></div>
            </dl>
            <p className="text-sm leading-relaxed text-ink-soft">{reasonText}</p>
            {forecast?.weeklyMinutes && reason === "ready" ? <p className="text-xs text-ink-soft">{new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(forecast.weeklyMinutes / 60)} {c.pace}</p> : null}
            {!readOnly ? <details className="text-sm">
              <summary className="w-fit cursor-pointer py-2 font-semibold">{entry.manualStartedAt ? c.edit : c.startMissing}</summary>
              <form action={saveCalendarStartAction} className="mt-2 flex flex-wrap items-end gap-3">
                <input type="hidden" name="entryId" value={entry.id} />
                <label className="grid gap-1">{c.start}<input type="date" name="start" required max={dateKey(entry.finishedAt ?? now)} defaultValue={entry.manualStartedAt ? dateKey(entry.manualStartedAt) : ""} className={inputStyle} /></label>
                <CalendarSubmit>{c.save}</CalendarSubmit>
              </form>
            </details> : null}
            {!readOnly && !entry.provider && entry.manualStartedAt && !["completed", "paused"].includes(reason) ? <details className="text-sm">
              <summary className="w-fit cursor-pointer py-2 font-semibold">{c.session}</summary>
              <p className="mb-3 max-w-xl text-xs leading-relaxed text-ink-soft">{c.sessionHelp}</p>
              <form action={saveCalendarMinutesAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="entryId" value={entry.id} />
                <label className="grid gap-1">{c.minutes}<input type="number" name="minutes" min="0" max="960" step="1" required defaultValue={entry.calendarSessions[0]?.minutes ?? ""} className={inputStyle} /></label>
                <CalendarSubmit>{c.save}</CalendarSubmit>
              </form>
            </details> : null}
          </article>;
        })}
        {!activeEntries.length ? <p className="py-4 text-sm text-ink-soft">{c.empty}</p> : null}
      </div>
      {!readOnly ? <details className="mt-5 border-t border-edge pt-4">
        <summary className="cursor-pointer text-sm font-semibold">{c.register}</summary>
        <form action={saveCalendarStartAction} className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="grid min-w-0 gap-1 text-sm">{c.game}<select className={inputStyle} name="entryId" required defaultValue=""><option value="" disabled>{c.choose}</option>{profile.shelfEntries.filter((entry) => !entry.finishedAt && !entry.manualStartedAt).map((entry) => <option value={entry.id} key={entry.id}>{entry.game.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm">{c.start}<input className={inputStyle} type="date" name="start" required max={dateKey(now)} /></label>
          <CalendarSubmit>{c.save}</CalendarSubmit>
        </form>
      </details> : null}
      <details className="mt-4 text-xs leading-relaxed text-ink-soft"><summary className="cursor-pointer py-2">{c.detail}</summary><p>{c.method}</p><p className="mt-2">{c.data}</p></details>
    </section>
    <section className={panel} aria-labelledby="calendar-agenda">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p id="calendar-agenda" className="text-xs font-bold uppercase tracking-wide text-ink-soft">{c.agenda}</p><h3 className="mt-1 font-display text-2xl capitalize">{new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(month)}</h3></div>
        <nav aria-label={c.monthNav} className="flex gap-2"><Button asChild size="icon" variant="outline"><Link aria-label={c.previous} href={href(-1)}><ChevronLeft className="size-4" /></Link></Button><Button asChild size="icon" variant="outline"><Link aria-label={c.next} href={href(1)}><ChevronRight className="size-4" /></Link></Button></nav>
      </div>
      <ol className="mt-5 divide-y divide-edge">
        {visible.map((event) => <li key={event.id} className="grid grid-cols-[3rem_1fr] gap-4 py-4">
          <time dateTime={dateKey(event.date)} className="font-display text-3xl tabular-nums text-ink-soft">{event.date.getUTCDate()}</time>
          <div className="min-w-0"><p className="text-xs font-semibold text-ink-soft">{event.kind}</p><p className="mt-1 break-words font-semibold">{event.href ? <Link href={event.href} className="hover:underline">{event.title}</Link> : event.title}</p>{event.extra ? <p className="mt-1 text-xs text-ink-soft">{event.extra}</p> : null}</div>
        </li>)}
      </ol>
      {!visible.length ? <p className="py-5 text-sm text-ink-soft">{c.noEvents}</p> : null}
      {data.saved.length ? <details className="mt-3 border-t border-edge pt-4"><summary className="cursor-pointer text-sm font-semibold">{c.savedReleases}</summary><p className="mt-2 text-xs text-ink-soft">{c.changedDate}</p><ul className="mt-3 grid gap-3">{data.saved.map(({ release }) => <li key={release.id} className="flex flex-wrap items-center justify-between gap-3 rounded-inner border border-edge p-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{release.game.name}</p><p className="text-xs text-ink-soft">{release.platform} · {release.region} · {release.releaseDate ? format(release.releaseDate) : c.noDay}</p><a className="text-xs underline" href={release.sourceUrl} target="_blank" rel="noopener noreferrer">{c.source}</a></div>{!readOnly ? <form action={setCalendarReleaseAction}><input type="hidden" name="releaseId" value={release.id} /><input type="hidden" name="operation" value="remove" /><CalendarSubmit>{c.remove}</CalendarSubmit></form> : null}</li>)}</ul></details> : null}
    </section>
    <section className={panel} aria-labelledby="calendar-releases">
      <h3 id="calendar-releases" className="font-display text-xl">{c.releases}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{c.releaseBody}</p>
      {data.releaseRun?.status === "failed" ? <p role="status" className="mt-3 text-sm text-ink-soft">{c.releaseFailed}</p> : !data.releaseRun?.finishedAt || now.getTime() - data.releaseRun.finishedAt.getTime() > 2 * DAY_MS ? <p className="mt-3 text-sm text-ink-soft">{c.releaseDelayed}</p> : null}
      <div className="mt-5 grid gap-4">
        {data.releases.map((release) => <article key={release.id} className="grid gap-3 rounded-inner border border-edge p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0"><h4 className="break-words font-display text-lg">{release.game.name}</h4><p className="mt-1 text-sm">{release.releaseDate ? format(release.releaseDate) : `${release.dateLabel} · ${c.noDay}`}</p><p className="mt-1 text-xs text-ink-soft">{release.platform} · {release.region}</p><p className="mt-2 text-xs text-ink-soft">{c.checked}: {format(release.checkedAt)} · <a className="underline underline-offset-2" href={release.sourceUrl} target="_blank" rel="noopener noreferrer">{c.source}</a></p></div>
          {!readOnly ? <form action={setCalendarReleaseAction}><input type="hidden" name="releaseId" value={release.id} /><input type="hidden" name="operation" value="add" /><CalendarSubmit disabled={savedIds.has(release.id) || !release.releaseDate}>{savedIds.has(release.id) ? c.added : c.add}</CalendarSubmit></form> : null}
        </article>)}
      </div>
      {!data.releases.length ? <p className="mt-4 text-sm text-ink-soft">{c.noReleases}</p> : null}
    </section>
  </section>;
}

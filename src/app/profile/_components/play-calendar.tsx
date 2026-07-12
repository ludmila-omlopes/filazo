import Link from "next/link";
import { CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { savePlayingNextDateAction } from "../actions";
import { Button } from "@/components/ui/button";
import { createTranslator, type Locale } from "@/lib/i18n";
import { buildPlayProjections, getPlayTimeBreakdown, weeklyHoursFromOnboarding } from "@/lib/play-planning";
import { CalendarRhythmForm } from "./onboarding-panel";
import type { ProfileData } from "./profile-types";

function dateKey(date: Date) { return date.toISOString().slice(0, 10); }
function formatHours(minutes: number, locale: Locale) { return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(minutes / 60); }

export function PlayCalendar({ calendarMonth, locale, profile, viewAsUserId }: {
  calendarMonth?: string;
  locale: Locale;
  profile: ProfileData;
  viewAsUserId?: string | null;
}) {
  const t = createTranslator(locale);
  const weeklyHours = weeklyHoursFromOnboarding(profile.user.onboardingAnswers);
  const entries = [...profile.currentPlayingEntries, ...profile.playingNextEntries];
  const projections = buildPlayProjections(entries, { weeklyHours });
  const now = new Date();
  const parsedMonth = calendarMonth?.match(/^(\d{4})-(\d{2})$/);
  const visibleMonth = parsedMonth
    ? new Date(Date.UTC(Number(parsedMonth[1]), Number(parsedMonth[2]) - 1, 1))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const previousMonth = new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth() - 1, 1));
  const nextMonth = new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth() + 1, 1));
  const monthHref = (month: Date) => {
    const params = new URLSearchParams({ tab: "calendar", month: dateKey(month).slice(0, 7) });
    if (viewAsUserId) params.set("viewAs", viewAsUserId);
    return `/profile?${params.toString()}`;
  };

  return <section className="grid gap-7">
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">{t("profile.calendar.kicker")}</p>
      <h2 className="mt-2 font-display text-3xl font-medium">{t("profile.calendar.title")}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{t("profile.calendar.body", { hours: weeklyHours })}</p>
    </header>

    <section className="rounded-card border border-edge bg-surface p-5 shadow-rest" aria-labelledby="calendar-rhythm-title">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">{t("profile.calendar.rhythmKicker")}</p>
      <h3 id="calendar-rhythm-title" className="mt-1 font-display text-xl">{t("setup.rhythm.title")}</h3>
      <p className="mt-1 text-sm text-ink-soft">{t("profile.calendar.rhythmBody")}</p>
      <div className="mt-5"><CalendarRhythmForm locale={locale} profile={profile} /></div>
    </section>

    <section className="rounded-card border border-edge bg-surface p-4 shadow-rest sm:p-6" aria-labelledby="calendar-grid-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="calendar-grid-title" className="flex items-center gap-2 font-display text-2xl capitalize"><CalendarDays className="size-5" />{new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(visibleMonth)}</h3>
        <nav className="flex gap-2" aria-label={t("profile.calendar.monthNavigation")}>
          <Button asChild size="sm" variant="outline"><Link href={monthHref(previousMonth)}><ChevronLeft className="size-4" />{t("profile.calendar.previousMonth")}</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href={monthHref(nextMonth)}>{t("profile.calendar.nextMonth")}<ChevronRight className="size-4" /></Link></Button>
        </nav>
      </div>
      <p className="mt-2 text-sm text-ink-soft">{t("profile.calendar.timelineCalendarBody")}</p>
      <div className="mt-4 overflow-x-auto">
        <TimelineCalendar entries={entries} gameLabel={t("profile.calendar.gameColumn")} locale={locale} month={visibleMonth} projections={projections} />
      </div>
      {!projections.length ? <p className="p-5 text-sm text-ink-soft">{t("profile.calendar.noPlan")}</p> : null}
    </section>

    <section className="rounded-card border border-edge bg-surface p-5 shadow-rest" aria-labelledby="timeline-title">
      <h3 id="timeline-title" className="font-display text-xl">{t("profile.calendar.timeline")}</h3>
      <p className="mt-1 text-sm text-ink-soft">{t("profile.calendar.timelineBody")}</p>
      <div className="mt-5 grid gap-5">
        {entries.map((entry) => {
          const time = getPlayTimeBreakdown(entry);
          if (!time) return <article className="rounded-inner border border-edge/70 p-4" key={entry.id}><strong>{entry.game.name}</strong><p className="mt-1 text-xs text-ink-soft">{t("profile.calendar.estimateUnavailable")}</p></article>;
          const playedPercent = time.totalMinutes ? time.playedMinutes / time.totalMinutes * 100 : 0;
          return <article key={entry.id}>
            <div className="flex flex-wrap items-end justify-between gap-2"><strong>{entry.game.name}</strong><span className="text-xs text-ink-soft">{t("profile.calendar.hoursBreakdown", { played: formatHours(time.playedMinutes, locale), remaining: formatHours(time.remainingMinutes, locale) })}</span></div>
            <div className="mt-2 flex h-4 overflow-hidden rounded-pill bg-canvas" role="img" aria-label={t("profile.calendar.hoursBreakdown", { played: formatHours(time.playedMinutes, locale), remaining: formatHours(time.remainingMinutes, locale) })}>
              <div className="bg-glow-strong" style={{ width: `${playedPercent}%` }} />
              <div className="flex-1 bg-glow/35" />
            </div>
          </article>;
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-soft"><span className="flex items-center gap-2"><i className="size-3 rounded-sm bg-glow-strong" />{t("profile.calendar.timePlayed")}</span><span className="flex items-center gap-2"><i className="size-3 rounded-sm bg-glow/35" />{t("profile.calendar.timeRemaining")}</span></div>
    </section>

    <section className="rounded-card border border-edge bg-surface p-5 shadow-rest" aria-labelledby="next-dates-title">
      <h3 id="next-dates-title" className="font-display text-xl">{t("profile.calendar.chooseDates")}</h3>
      <p className="mt-1 text-sm text-ink-soft">{t("profile.calendar.chooseDatesBody")}</p>
      <div className="mt-4 grid gap-3">
        {profile.playingNextEntries.map((entry) => <form action={savePlayingNextDateAction} className="grid items-center gap-3 rounded-inner border border-edge/70 p-3 sm:grid-cols-[1fr_auto_auto]" key={entry.id}>
          <input name="entryId" type="hidden" value={entry.id} />
          <label className="font-semibold" htmlFor={`planned-${entry.id}`}>{entry.game.name}</label>
          <input className="min-h-10 rounded-inner border border-edge bg-canvas px-3 text-sm" defaultValue={entry.plannedStartDate ? dateKey(entry.plannedStartDate) : ""} id={`planned-${entry.id}`} min={dateKey(new Date())} name="plannedStartDate" required type="date" />
          <Button size="sm" type="submit"><Check className="size-4" />{t("profile.calendar.saveDate")}</Button>
        </form>)}
        {!profile.playingNextEntries.length ? <p className="py-4 text-sm text-ink-soft">{t("profile.calendar.noPlan")}</p> : null}
      </div>
    </section>
    <p className="text-xs leading-relaxed text-ink-soft">{t("profile.calendar.disclaimer")}</p>
  </section>;
}

function TimelineCalendar({ entries, gameLabel, locale, month, projections }: {
  entries: ProfileData["currentPlayingEntries"];
  gameLabel: string;
  locale: Locale;
  month: Date;
  projections: ReturnType<typeof buildPlayProjections>;
}) {
  const days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const monthEnd = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  const dayMs = 86_400_000;
  const projectionByEntry = new Map(projections.map((projection) => [projection.entryId, projection]));
  return <div className="min-w-[1120px] overflow-hidden rounded-inner border border-edge">
    <div className="grid grid-cols-[190px_1fr] border-b border-edge bg-canvas">
      <div className="border-r border-edge p-3 text-xs font-bold uppercase text-ink-soft">{gameLabel}</div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${days}, minmax(28px, 1fr))` }}>
        {Array.from({ length: days }, (_, index) => { const date = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), index + 1)); return <div className="border-r border-edge/60 py-2 text-center" key={index}><span className="block text-[10px] uppercase text-ink-soft">{new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(date)}</span><span className="text-xs font-bold">{index + 1}</span></div>; })}
      </div>
    </div>
    {entries.map((entry) => {
      const projection = projectionByEntry.get(entry.id);
      const overlaps = projection && projection.finishDate >= month && projection.startDate < monthEnd;
      const start = overlaps ? new Date(Math.max(projection.startDate.getTime(), month.getTime())) : null;
      const endExclusive = overlaps ? new Date(Math.min(projection.finishDate.getTime() + dayMs, monthEnd.getTime())) : null;
      const left = start ? (start.getTime() - month.getTime()) / dayMs / days * 100 : 0;
      const width = start && endExclusive ? (endExclusive.getTime() - start.getTime()) / dayMs / days * 100 : 0;
      return <div className="grid min-h-14 grid-cols-[190px_1fr] border-b border-edge last:border-b-0" key={entry.id}>
        <div className="flex items-center border-r border-edge bg-surface px-3"><span className="line-clamp-2 text-sm font-semibold">{entry.game.name}</span></div>
        <div className="relative" style={{ backgroundImage: "linear-gradient(to right, transparent calc(100% - 1px), var(--color-edge) calc(100% - 1px))", backgroundSize: `${100 / days}% 100%` }}>
          {overlaps ? <Link
            aria-label={`${entry.game.name}: ${dateKey(projection.startDate)} – ${dateKey(projection.finishDate)}`}
            className={`absolute top-2.5 flex h-9 items-center overflow-hidden rounded-md px-3 text-xs font-extrabold shadow-rest transition-[filter,transform] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${projection.kind === "current" ? "bg-glow text-[#241d3d]" : "border border-edge bg-dusk-deep text-white"}`}
            href={`/games/${entry.game.slug}`}
            style={{ left: `${left}%`, width: `${Math.max(width, 2.5)}%` }}
            title={`${entry.game.name}: ${dateKey(projection.startDate)} – ${dateKey(projection.finishDate)}`}
          ><span className="truncate">{entry.game.name}</span></Link> : null}
        </div>
      </div>;
    })}
  </div>;
}

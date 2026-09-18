import type { Locale } from "@/lib/i18n";
import { calendarCopy } from "@/lib/calendar-copy";
import { readCalendar } from "@/lib/calendar";
import { calendarMonth as parseMonth, DAY_MS, isCalendarEstimateCurrent } from "@/lib/calendar-policy";
import { deleteCalendarEventAction, saveCalendarEventAction, setCalendarReleaseAction } from "../calendar-actions";
import { CalendarSubmit } from "./calendar-submit";
import { CalendarMonthView } from "./calendar-month-view";
import type { CalendarEvent } from "@/lib/calendar-month";
import { calendarStartForGame, playDateProviderName } from "@/lib/provider-play-dates";
import type { ProfileData } from "./profile-types";

const panel = "rounded-card border border-edge bg-surface p-5 sm:p-6";
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
type CalendarProps = { calendarMonth?: string; calendarStatus?: string; locale: Locale; profile: ProfileData; viewAsUserId?: string | null };
type CalendarRelease = Awaited<ReturnType<typeof readCalendar>>["releases"][number];
type ReleaseGroup = { gameId: string; game: CalendarRelease["game"]; releases: CalendarRelease[]; sources: { url: string; checkedAt: Date }[] };

function groupReleaseAnnouncements(releases: CalendarRelease[]) {
  const groups = new Map<string, ReleaseGroup>();
  for (const release of releases) {
    const group = groups.get(release.gameId) ?? { gameId: release.gameId, game: release.game, releases: [], sources: [] };
    group.releases.push(release);
    for (const url of releaseSources(release)) if (!group.sources.some((source) => source.url === url)) group.sources.push({ url, checkedAt: release.checkedAt });
    groups.set(release.gameId, group);
  }
  return [...groups.values()];
}

function sourceHost(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function releaseSources(release: CalendarRelease) {
  const stored = Array.isArray(release.sourceUrls) ? release.sourceUrls.filter((value): value is string => typeof value === "string") : [];
  return stored.length ? stored : [release.sourceUrl];
}

export async function PlayCalendar(props: CalendarProps) {
  let data: Awaited<ReturnType<typeof readCalendar>>;
  try { data = await readCalendar(props.profile.user.id); }
  catch { return <p role="alert" className={panel}>{calendarCopy(props.locale).loadFailed}</p>; }
  return <CalendarView {...props} data={data} />;
}

export function CalendarView({ calendarMonth, calendarStatus, locale, viewAsUserId, data }: CalendarProps & { data: Awaited<ReturnType<typeof readCalendar>> }) {
  const c = calendarCopy(locale);
  const now = new Date();
  const month = parseMonth(calendarMonth, now);
  const format = (date: Date) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  const readOnly = Boolean(viewAsUserId);
  const savedIds = new Set(data.saved.map((item) => item.releaseId));
  const releaseGroups = groupReleaseAnnouncements(data.releases);
  const manualGames = new Set(data.entries.filter(entry => entry.manualStartedAt).map(entry => entry.gameId));
  const gameById = new Map(data.entries.map(entry => [entry.gameId, entry.game]));
  const events: CalendarEvent[] = [];
  for (const entry of data.entries) {
    const gameHref = `/games/${entry.game.slug}`;
    const start = calendarStartForGame(entry, data.playDates, data.entries);
    if (start.date && (entry.manualStartedAt || !manualGames.has(entry.gameId)) && !events.some(event => event.id === `${entry.gameId}-start-${dateKey(start.date!)}`)) events.push({ id: `${entry.gameId}-start-${dateKey(start.date)}`, date: dateKey(start.date), title: entry.game.name, kind: "start", href: gameHref, extra: start.provider ? `${c.importedFrom} ${playDateProviderName(start.provider)}` : c.manualDate });
    if (entry.finishedAt) events.push({ id: `${entry.id}-finish`, date: dateKey(entry.finishedAt), title: entry.game.name, kind: "finish", href: gameHref });
    else if (entry.calendarEstimate?.estimatedFinish && isCalendarEstimateCurrent(entry.calendarEstimate, now) && entry.status !== "COMPLETED" && entry.status !== "DROPPED" && entry.activeBacklog) events.push({ id: `${entry.id}-estimate`, date: dateKey(entry.calendarEstimate.estimatedFinish), title: entry.game.name, kind: "estimate", href: gameHref });
  }
  const activityByDay = new Map<string, { gameId: string; date: string; providers: Set<string> }>();
  for (const item of data.playDates) {
    const date = dateKey(item.day);
    const key = `${item.gameId}:${date}`;
    const activity = activityByDay.get(key) ?? { gameId: item.gameId, date, providers: new Set<string>() };
    activity.providers.add(playDateProviderName(item.provider));
    activityByDay.set(key, activity);
  }
  for (const [key, activity] of activityByDay) {
    const game = gameById.get(activity.gameId);
    if (!game || events.some(event => event.href === `/games/${game.slug}` && event.date === activity.date && ["start", "finish"].includes(event.kind))) continue;
    events.push({ id: `activity:${key}`, date: activity.date, title: game.name, kind: "played", href: `/games/${game.slug}`, extra: `${c.importedFrom} ${[...activity.providers].join(", ")}` });
  }
  for (const { release } of data.saved) {
    if (release.releaseDate) events.push({ id: release.id, date: dateKey(release.releaseDate), title: release.game.name, kind: "release", extra: `${release.platform} · ${release.region}` });
  }
  for (const event of data.manualEvents) events.push({ id: `manual:${event.id}`, date: dateKey(event.date), title: event.title, kind: "manual", extra: event.notes ?? undefined });
  const notices = { refreshed: c.refreshed, saved: c.saved, limited: c.limited, failed: c.failed, invalid: c.invalid, eventSaved: c.eventSaved, eventDeleted: c.eventDeleted };
  const notice = calendarStatus && Object.hasOwn(notices, calendarStatus) ? notices[calendarStatus as keyof typeof notices] : null;

  return <section className="grid min-w-0 gap-7">
    <header className="grid gap-3">
      <h2 className="font-display text-3xl font-medium">{c.title}</h2>
      <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">{c.body}</p>
      {readOnly ? <p className="text-sm text-ink-soft">{c.preview}</p> : null}
      {notice ? <p className="rounded-inner border border-edge bg-canvas p-3 text-sm" role="status">{notice}</p> : null}
    </header>
    <section className={panel} aria-labelledby="calendar-agenda">
      <CalendarMonthView key={dateKey(month)} initialMonth={dateKey(month).slice(0, 7)} today={dateKey(now)} events={events} locale={locale} />
      <p className="mt-3 text-xs leading-relaxed text-ink-soft">{c.platformDateHelp}</p>
      {!readOnly ? <details className="mt-5 border-t border-edge pt-4"><summary className="cursor-pointer text-sm font-semibold">{c.addEvent}</summary><form action={saveCalendarEventAction} className="mt-4 grid max-w-xl gap-3"><label className="grid gap-1 text-sm font-semibold" htmlFor="calendar-event-title">{c.eventTitle}<input id="calendar-event-title" name="title" required maxLength={160} className="rounded-inner border border-edge bg-canvas px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold" htmlFor="calendar-event-date">{c.eventDate}<input id="calendar-event-date" type="date" name="date" required className="rounded-inner border border-edge bg-canvas px-3 py-2 font-normal" defaultValue={dateKey(now)} /></label><label className="grid gap-1 text-sm font-semibold" htmlFor="calendar-event-notes">{c.eventNotes}<textarea id="calendar-event-notes" name="notes" maxLength={500} rows={3} placeholder={c.eventNotesPlaceholder} className="rounded-inner border border-edge bg-canvas px-3 py-2 font-normal" /></label><div><CalendarSubmit>{c.saveEvent}</CalendarSubmit></div></form></details> : null}
      {data.manualEvents.length ? <details className="mt-4 border-t border-edge pt-4"><summary className="cursor-pointer text-sm font-semibold">{c.manageEvents}</summary><ul className="mt-3 grid gap-3">{data.manualEvents.map((event) => <li key={event.id} className="flex flex-wrap items-start justify-between gap-3 rounded-inner border border-edge p-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{event.title}</p><time dateTime={dateKey(event.date)} className="text-xs text-ink-soft">{format(event.date)}</time>{event.notes ? <p className="mt-1 text-xs text-ink-soft">{event.notes}</p> : null}</div>{!readOnly ? <form action={deleteCalendarEventAction}><input type="hidden" name="eventId" value={event.id} /><CalendarSubmit>{c.deleteEvent}</CalendarSubmit></form> : null}</li>)}</ul></details> : null}
      {data.saved.length ? <details className="mt-3 border-t border-edge pt-4"><summary className="cursor-pointer text-sm font-semibold">{c.savedReleases}</summary><p className="mt-2 text-xs text-ink-soft">{c.changedDate}</p><ul className="mt-3 grid gap-3">{data.saved.map(({ release }) => <li key={release.id} className="flex flex-wrap items-center justify-between gap-3 rounded-inner border border-edge p-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{release.game.name}</p><p className="text-xs text-ink-soft">{release.platform} · {release.region} · {release.releaseDate ? format(release.releaseDate) : c.noDay}</p><a className="text-xs underline" href={release.sourceUrl} target="_blank" rel="noopener noreferrer">{c.source}</a></div>{!readOnly ? <form action={setCalendarReleaseAction}><input type="hidden" name="releaseId" value={release.id} /><input type="hidden" name="operation" value="remove" /><CalendarSubmit>{c.remove}</CalendarSubmit></form> : null}</li>)}</ul></details> : null}
    </section>
    <section className={panel} aria-labelledby="calendar-releases">
      <h3 id="calendar-releases" className="font-display text-xl">{c.releases}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{c.releaseBody}</p>
      {data.releaseRun?.status === "failed" ? <p role="status" className="mt-3 text-sm text-ink-soft">{c.releaseFailed}</p> : !data.releaseRun?.finishedAt || now.getTime() - data.releaseRun.finishedAt.getTime() > 2 * DAY_MS ? <p className="mt-3 text-sm text-ink-soft">{c.releaseDelayed}</p> : null}
      <div className="mt-5 grid gap-4">
        {releaseGroups.map((group) => {
          const latestChecked = group.releases.reduce((latest, release) => release.checkedAt > latest ? release.checkedAt : latest, group.releases[0].checkedAt);
          const alreadySaved = group.releases.every((release) => savedIds.has(release.id));
          const canAdd = group.releases.some((release) => release.releaseDate && !savedIds.has(release.id));
          return <article key={group.gameId} className="grid gap-4 rounded-inner border border-edge p-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="min-w-0">
              <h4 className="break-words font-display text-lg">{group.game.name}</h4>
              <ul className="mt-3 grid gap-2 text-sm">
                {group.releases.map((release) => <li key={release.id} className="flex flex-wrap gap-x-3 gap-y-1"><span className="font-semibold">{release.platform}</span><span>{release.releaseDate ? format(release.releaseDate) : `${release.dateLabel} (${c.noDay})`}</span><span className="text-ink-soft">{release.region}</span></li>)}
              </ul>
              <p className="mt-3 text-xs text-ink-soft">{c.sources}</p>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {group.sources.map((source) => <li key={source.url}><a className="underline underline-offset-2" href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`${c.source}: ${sourceHost(source.url)}`}>{sourceHost(source.url)}</a></li>)}
              </ul>
              <p className="mt-2 text-xs text-ink-soft">{c.checked}: {format(latestChecked)}</p>
            </div>
            {!readOnly ? <form action={setCalendarReleaseAction} className="sm:pt-0"><input type="hidden" name="operation" value="add" />{group.releases.map((release) => <input type="hidden" name="releaseId" value={release.id} key={release.id} />)}<CalendarSubmit disabled={!canAdd}>{alreadySaved ? c.added : c.add}</CalendarSubmit></form> : null}
          </article>;
        })}
      </div>
      {!data.releases.length ? <p className="mt-4 text-sm text-ink-soft">{c.noReleases}</p> : null}
    </section>
  </section>;
}

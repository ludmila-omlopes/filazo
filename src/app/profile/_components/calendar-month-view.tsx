"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronLeft, ChevronRight, CircleDashed, Gamepad2, List, NotebookPen, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calendarCopy } from "@/lib/calendar-copy";
import { calendarMonthDays, eventsInCalendarMonth, shiftCalendarMonth, type CalendarEvent, type CalendarEventKind } from "@/lib/calendar-month";
import type { Locale } from "@/lib/i18n";

const icons = { start: Play, finish: Check, estimate: CircleDashed, release: CalendarDays, played: Gamepad2, manual: NotebookPen };
const kinds: CalendarEventKind[] = ["start", "played", "finish", "estimate", "release", "manual"];

export function CalendarMonthView({ initialMonth, today, events, locale }: { initialMonth: string; today: string; events: CalendarEvent[]; locale: Locale }) {
  const c = calendarCopy(locale);
  const [month, setMonth] = useState(initialMonth);
  const [selected, setSelected] = useState(today.startsWith(initialMonth) ? today : eventsInCalendarMonth(events, initialMonth)[0]?.date ?? `${initialMonth}-01`);
  const [view, setView] = useState<"month" | "list">("month");
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const labels = { start: c.began, finish: c.actualFinish, estimate: c.estimated, release: c.release, played: c.played, manual: c.manual };
  const days = calendarMonthDays(month);
  const visible = eventsInCalendarMonth(events, month);
  const selectedEvents = visible.filter(event => event.date === selected);
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const fullDate = (date: string) => new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  const weekdays = Array.from({ length: 7 }, (_, day) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 1, 1 + day))));

  function changeMonth(target: string, selectToday = false) {
    setMonth(target);
    setSelected(selectToday || today.startsWith(target) ? today : eventsInCalendarMonth(events, target)[0]?.date ?? `${target}-01`);
  }

  function moveDay(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const index = days.findIndex(day => day.date === date);
    const targets: Record<string, number> = { ArrowLeft: index - 1, ArrowRight: index + 1, ArrowUp: index - 7, ArrowDown: index + 7, Home: index - index % 7, End: index + 6 - index % 7 };
    if (!(event.key in targets)) return;
    event.preventDefault();
    const first = days.findIndex(day => day.inMonth);
    const last = days.findLastIndex(day => day.inMonth);
    const target = days[Math.max(first, Math.min(last, targets[event.key]))].date;
    setSelected(target);
    buttons.current.get(target)?.focus();
  }

  function eventList(items: CalendarEvent[], showDate = false) {
    return <ol className="divide-y divide-edge">{items.map(event => {
      const Icon = icons[event.kind];
      return <li key={event.id} className="flex items-start gap-3 py-4">
        <Icon aria-hidden="true" className="mt-1 size-4 shrink-0 text-ink-soft" />
        <div className="min-w-0">
          {showDate ? <time dateTime={event.date} className="mb-1 block text-xs font-semibold capitalize text-ink-soft">{fullDate(event.date)}</time> : null}
          <p className="text-xs text-ink-soft">{labels[event.kind]}</p>
          <p className="mt-1 break-words font-semibold">{event.href ? <Link href={event.href} className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">{event.title}</Link> : event.title}</p>
          {event.extra ? <p className="mt-1 text-xs text-ink-soft">{event.extra}</p> : null}
          {event.kind === "estimate" ? <p className="mt-1 text-xs text-ink-soft">{c.estimateReminder}</p> : null}
        </div>
      </li>;
    })}</ol>;
  }

  return <div className="min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h3 id="calendar-agenda" className="font-display text-xl">{c.agenda}</h3><p className="mt-1 text-sm text-ink-soft">{c.selectDay}</p></div>
      <div role="group" aria-label={c.viewLabel} className="flex gap-1 rounded-inner border border-edge p-1">
        <Button size="sm" variant={view === "month" ? "secondary" : "link"} aria-pressed={view === "month"} onClick={() => setView("month")}><CalendarDays aria-hidden="true" className="size-4" />{c.monthView}</Button>
        <Button size="sm" variant={view === "list" ? "secondary" : "link"} aria-pressed={view === "list"} onClick={() => setView("list")}><List aria-hidden="true" className="size-4" />{c.listView}</Button>
      </div>
    </div>
    <div className="my-5 flex flex-wrap items-center justify-between gap-3">
      <p aria-live="polite" className="font-display text-2xl font-medium first-letter:uppercase">{monthLabel}</p>
      <nav aria-label={c.monthNav} className="flex items-center gap-1">
        <Button size="icon" variant="link" aria-label={c.previous} disabled={month <= "1900-01"} onClick={() => changeMonth(shiftCalendarMonth(month, -1))}><ChevronLeft className="size-4" /></Button>
        <Button size="sm" variant="outline" onClick={() => changeMonth(today.slice(0, 7), true)}>{c.today}</Button>
        <Button size="icon" variant="link" aria-label={c.next} disabled={month >= "2100-12"} onClick={() => changeMonth(shiftCalendarMonth(month, 1))}><ChevronRight className="size-4" /></Button>
      </nav>
    </div>
    {view === "month" ? <>
      <table className="w-full table-fixed border-collapse" aria-label={monthLabel}>
        <thead><tr>{weekdays.map((name, index) => <th scope="col" key={index} className="pb-3 text-center text-xs font-medium capitalize text-ink-soft">{name}</th>)}</tr></thead>
        <tbody>{Array.from({ length: days.length / 7 }, (_, week) => <tr key={week}>{days.slice(week * 7, week * 7 + 7).map(day => {
          const dayEvents = visible.filter(event => event.date === day.date);
          const isToday = day.date === today;
          const isSelected = day.date === selected;
          return <td key={day.date} className="border border-edge p-0 align-top">
            {day.inMonth ? <button type="button" ref={element => { if (element) buttons.current.set(day.date, element); else buttons.current.delete(day.date); }}
              aria-label={`${fullDate(day.date)}${isToday ? `, ${c.today}` : ""}. ${dayEvents.length ? dayEvents.map(event => `${labels[event.kind]}: ${event.title}`).join("; ") : c.noDayEvents}`}
              aria-pressed={isSelected} aria-current={isToday ? "date" : undefined} aria-controls="calendar-day-detail" tabIndex={isSelected ? 0 : -1}
              onClick={() => setSelected(day.date)} onKeyDown={event => moveDay(event, day.date)}
              className={`flex min-h-16 w-full min-w-0 flex-col items-start gap-1 p-1 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink md:min-h-32 md:p-2 ${isSelected ? "bg-sage-soft ring-2 ring-inset ring-ink" : "bg-surface hover:bg-canvas"}`}>
              <time dateTime={day.date} className={`inline-flex size-7 shrink-0 items-center justify-center rounded-inner text-sm font-semibold tabular-nums ${isToday ? "bg-ink text-surface" : "text-ink"}`}>{day.day}</time>
              <span aria-hidden="true" className="grid min-h-4 grid-cols-2 gap-0.5 md:hidden">{kinds.filter(kind => dayEvents.some(event => event.kind === kind)).map(kind => { const Icon = icons[kind]; return <Icon key={kind} className="size-3" />; })}</span>
              <span aria-hidden="true" className="hidden w-full min-w-0 space-y-1 md:block">{dayEvents.slice(0, 2).map(event => { const Icon = icons[event.kind]; return <span key={event.id} className={`flex min-w-0 items-start gap-1 border-l-2 py-0.5 pl-1 text-xs ${event.kind === "estimate" ? "border-dashed border-ink-soft" : "border-ink-soft"}`}><Icon className="mt-0.5 size-3 shrink-0" /><span className="truncate">{event.title}</span></span>; })}{dayEvents.length > 2 ? <span className="block text-xs text-ink-soft">+{dayEvents.length - 2} {c.moreEvents}</span> : null}</span>
            </button> : <span aria-hidden="true" className="flex min-h-16 bg-canvas/50 p-1 text-xs text-ink-soft/60 md:min-h-32 md:p-2"><span className="inline-flex size-7 items-center justify-center">{day.day}</span></span>}
          </td>;
        })}</tr>)}</tbody>
      </table>
      <ul aria-label={c.legend} className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-soft">{kinds.map(kind => { const Icon = icons[kind]; return <li key={kind} className="flex items-center gap-1.5"><Icon aria-hidden="true" className="size-3.5" />{labels[kind]}</li>; })}</ul>
      <section id="calendar-day-detail" aria-live="polite" aria-atomic="true" className="mt-5 border-t border-edge pt-5">
        <h4 className="font-display text-lg first-letter:uppercase">{fullDate(selected)}</h4>
        {selectedEvents.length ? eventList(selectedEvents) : <p className="py-4 text-sm text-ink-soft">{c.noDayEvents}</p>}
      </section>
    </> : eventList(visible, true)}
    {!visible.length ? <p className="rounded-inner bg-canvas p-3 text-sm text-ink-soft">{c.noEvents} {c.calendarEmptyHelp}</p> : null}
  </div>;
}

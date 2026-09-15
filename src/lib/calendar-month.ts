export type CalendarEventKind = "start" | "finish" | "estimate" | "release" | "played";
export type CalendarEvent = { id: string; date: string; title: string; kind: CalendarEventKind; href?: string; extra?: string };

const DAY = 86_400_000;
export function calendarMonthDays(month: string) {
  const start = new Date(`${month}-01T00:00:00Z`);
  const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  const firstCell = start.getTime() - start.getUTCDay() * DAY;
  const length = Math.ceil((start.getUTCDay() + last.getUTCDate()) / 7) * 7;
  return Array.from({ length }, (_, index) => {
    const date = new Date(firstCell + index * DAY);
    const key = date.toISOString().slice(0, 10);
    return { date: key, day: date.getUTCDate(), inMonth: key.startsWith(month) };
  });
}

export function shiftCalendarMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1)).toISOString().slice(0, 7);
}

export function eventsInCalendarMonth(events: CalendarEvent[], month: string) {
  return events.filter(event => event.date.startsWith(`${month}-`)).sort((a, b) => a.date.localeCompare(b.date));
}

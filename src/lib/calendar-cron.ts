import { timingSafeEqual } from "node:crypto";

export function authorizeCalendarCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const value = request.headers.get("authorization");
  if (!secret || !value || new URL(request.url).search) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(value);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function calendarWorkersEnabled() {
  return process.env.CALENDAR_WORKERS_ENABLED === "true" && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production");
}

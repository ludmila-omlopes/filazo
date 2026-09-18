import { authorizeCalendarCron, calendarWorkersEnabled } from "@/lib/calendar-cron";
import { runDailyCalendars } from "@/lib/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorizeCalendarCron(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  if (!calendarWorkersEnabled()) return Response.json({ status: "disabled" }, { headers });
  try {
    const result = await runDailyCalendars();
    return Response.json(result, { status: result.failed ? 503 : 200, headers });
  } catch { return Response.json({ error: "calendar-refresh-failed" }, { status: 503, headers }); }
}

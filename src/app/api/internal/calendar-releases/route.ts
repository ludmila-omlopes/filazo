import { authorizeCalendarCron, calendarWorkersEnabled } from "@/lib/calendar-cron";
import { runReleaseDateSearch } from "@/lib/calendar-release-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorizeCalendarCron(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  if (!calendarWorkersEnabled()) return Response.json({ status: "disabled" }, { headers });
  try {
    const result = await runReleaseDateSearch();
    return Response.json(result, { status: result.status === "failed" ? 503 : 200, headers });
  } catch { return Response.json({ error: "release-search-failed" }, { status: 503, headers }); }
}

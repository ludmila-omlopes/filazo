import { timingSafeEqual } from "node:crypto";
import { runScheduledPlatformSyncs } from "@/lib/platform-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const responseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body: Record<string, boolean | number | string | null>, status = 200) {
  return Response.json(body, { headers: responseHeaders, status });
}

function hasValidCronSecret(authorization: string | null) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !authorization) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(authorization);
  const equalLength = expected.length === supplied.length;
  const comparable = equalLength ? supplied : Buffer.alloc(expected.length);

  return timingSafeEqual(expected, comparable) && equalLength;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.search) {
    return json({ ok: false, error: "invalid-request" }, 400);
  }
  if (!hasValidCronSecret(request.headers.get("authorization"))) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  try {
    const result = await runScheduledPlatformSyncs();
    if (!result.accepted || !result.summary) {
      return json({ ok: true, status: "ignored" });
    }

    return json({
      ok: true,
      status: result.summary.disabled ? "disabled" : "completed",
      started: result.summary.started,
      succeeded: result.summary.succeeded,
      failed: result.summary.failed,
      skipped: result.summary.skipped,
    });
  } catch {
    // The detailed run records contain the sanitized provider result. The
    // endpoint itself intentionally exposes no account, provider, or error data.
    return json({ ok: false, error: "sync-unavailable" }, 503);
  }
}

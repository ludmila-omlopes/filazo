import { pruneAbuseLimits } from "@/lib/abuse-limits";
import { hasInternalWorkerAuth } from "@/lib/internal-worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasInternalWorkerAuth(request)) return new Response(null, { status: 401 });
  try {
    const deleted = await pruneAbuseLimits();
    return Response.json({ deleted }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Cleanup unavailable." }, { status: 503 });
  }
}

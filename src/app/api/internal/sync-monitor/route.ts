import { revalidatePath } from "next/cache";
import { hasInternalWorkerAuth } from "@/lib/internal-worker-auth";
import { syncIncidentMonitor } from "@/lib/sync-incident-monitor";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasInternalWorkerAuth(request)) return new Response(null, { status: 401 });
  try {
    const result = await syncIncidentMonitor.scan();
    if (result.accepted) {
      revalidatePath("/admin");
      revalidatePath("/admin/feedback");
      revalidatePath("/admin/sync");
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Sync incident monitor could not finish its scan.");
    return Response.json({ ok: false }, { status: 503 });
  }
}

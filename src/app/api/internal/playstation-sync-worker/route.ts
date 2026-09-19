import { revalidatePath } from "next/cache";
import { playStationSyncQueue } from "@/lib/playstation-sync-queue";
import { hasInternalWorkerAuth } from "@/lib/internal-worker-auth";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasInternalWorkerAuth(request)) return new Response(null, { status: 401 });
  try {
    // Recovery belongs to accepted manual work, not to Pro daily refreshes.
    await playStationSyncQueue.recoverInterruptedManualRuns();
    if (await playStationSyncQueue.drain()) {
      revalidatePath("/profile");
      revalidatePath("/");
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

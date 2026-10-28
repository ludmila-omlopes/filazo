import { revalidatePath } from "next/cache";
import { playStationSyncQueue } from "@/lib/playstation-sync-queue";
import { hasInternalWorkerAuth } from "@/lib/internal-worker-auth";
import { continueWorker, readWorkerHop } from "@/lib/worker-continuation";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasInternalWorkerAuth(request)) return new Response(null, { status: 401 });
  const hop = readWorkerHop(request);
  try {
    // Recovery belongs to accepted manual work, not to Pro daily refreshes.
    // Scheduled passes run it; continuations only follow work already started.
    if (!hop) await playStationSyncQueue.recoverInterruptedManualRuns();
    if (await playStationSyncQueue.drain()) {
      revalidatePath("/profile");
      revalidatePath("/");
      // Continue a long library now; enrich imported games once it is done.
      if (await playStationSyncQueue.hasDueWork()) continueWorker("playstation", hop);
      else continueWorker("metadata");
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

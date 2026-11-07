import { revalidatePath } from "next/cache";
import { playStationSyncQueue } from "@/lib/playstation-sync-queue";
import { hasInternalWorkerAuth } from "@/lib/internal-worker-auth";
import { continueSyncQueue, readWorkerHop } from "@/lib/worker-continuation";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasInternalWorkerAuth(request)) return new Response(null, { status: 401 });
  const hop = readWorkerHop(request);
  const startedAt = Date.now();
  try {
    // Recovery belongs to accepted manual work, not to Pro daily refreshes.
    // Scheduled passes run it; continuations only follow work already started.
    if (!hop) await playStationSyncQueue.recoverInterruptedManualRuns();
    const worked = await playStationSyncQueue.drain();
    if (worked) {
      revalidatePath("/profile");
      revalidatePath("/");
    }
    // Continue a long library or a short retry now; enrich imported games once it is done.
    await continueSyncQueue("playstation", playStationSyncQueue, { worked, hop, startedAt });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

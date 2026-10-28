import { revalidatePath } from "next/cache";
import { steamSyncQueue } from "@/lib/steam-sync-queue";
import { hasInternalWorkerAuth } from "@/lib/internal-worker-auth";
import { continueWorker, readWorkerHop } from "@/lib/worker-continuation";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasInternalWorkerAuth(request)) return new Response(null, { status: 401 });
  const hop = readWorkerHop(request);
  try {
    // Always service accepted work, even when automatic daily syncing is off.
    if (await steamSyncQueue.drain()) {
      revalidatePath("/profile");
      revalidatePath("/");
      // Continue a long library now; enrich imported games once it is done.
      if (await steamSyncQueue.hasDueWork()) continueWorker("steam", hop);
      else continueWorker("metadata");
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

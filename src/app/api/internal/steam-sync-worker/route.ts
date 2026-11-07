import { revalidatePath } from "next/cache";
import { steamSyncQueue } from "@/lib/steam-sync-queue";
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
    // Always service accepted work, even when automatic daily syncing is off.
    const worked = await steamSyncQueue.drain();
    if (worked) {
      revalidatePath("/profile");
      revalidatePath("/");
    }
    // Continue a long library or a short retry now; enrich imported games once it is done.
    await continueSyncQueue("steam", steamSyncQueue, { worked, hop, startedAt });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

import { revalidatePath } from "next/cache";
import { gogSyncQueue } from "@/lib/gog-sync-queue";
import { hasInternalWorkerAuth } from "@/lib/internal-worker-auth";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasInternalWorkerAuth(request)) return new Response(null, { status: 401 });
  try {
    // Accepted imports continue even when automatic daily scheduling is off.
    if (await gogSyncQueue.drain()) {
      revalidatePath("/profile");
      revalidatePath("/");
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

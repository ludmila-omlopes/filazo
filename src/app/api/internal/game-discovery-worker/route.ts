import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { discoveryWorkerScope, prepareGameDiscovery, seedDiscoveryJobs } from "@/lib/game-discovery";
import { hasInternalWorkerAuth } from "@/lib/internal-worker-auth";
import { getSyncWorkerScope } from "@/lib/steam-sync-state";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasInternalWorkerAuth(request)) return new Response(null, { status: 401 });
  if (!process.env.IGDB_CLIENT_ID || !process.env.IGDB_CLIENT_SECRET) return Response.json({ ok: true, configured: false });
  const workerScope = discoveryWorkerScope(getSyncWorkerScope());
  const deadline = Date.now() + 40_000;
  let completed = 0;
  try {
    await seedDiscoveryJobs(workerScope);
    while (Date.now() < deadline - 10_000) {
      const now = new Date();
      const candidate = await prisma.gameMetadataJob.findFirst({
        where: { workerScope, nextAttemptAt: { lte: now }, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }] },
        orderBy: [{ nextAttemptAt: "asc" }, { gameId: "asc" }],
      });
      if (!candidate) break;
      const token = randomUUID();
      const where = { gameId: candidate.gameId, workerScope };
      const claim = await prisma.gameMetadataJob.updateMany({
        where: { ...where, nextAttemptAt: { lte: now }, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }] },
        data: { workerToken: token, leaseExpiresAt: new Date(Date.now() + 90_000) },
      });
      if (!claim.count) continue;
      try {
        await prepareGameDiscovery(candidate.gameId, workerScope, token, AbortSignal.timeout(Math.max(1, deadline - Date.now())));
        await prisma.gameMetadataJob.deleteMany({ where: { ...where, workerToken: token } });
        completed++;
      } catch {
        // Retain the previous complete snapshot on failure; bounded retry backoff.
        await prisma.gameMetadataJob.updateMany({ where: { ...where, workerToken: token }, data: {
          workerToken: null, leaseExpiresAt: null, attempt: { increment: 1 },
          nextAttemptAt: new Date(Date.now() + Math.min(24, 2 ** Math.min(candidate.attempt, 5)) * 3600000),
        } });
      }
    }
    return Response.json({ ok: true, completed }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { enrichCatalogGame } from "@/lib/catalog";
import { hasInternalWorkerAuth } from "@/lib/internal-worker-auth";
import { getSyncWorkerScope } from "@/lib/steam-sync-state";
import { continueWorker, readWorkerHop } from "@/lib/worker-continuation";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasInternalWorkerAuth(request)) return new Response(null, { status: 401 });
  const hop = readWorkerHop(request);
  const deadline = Date.now() + 30_000;
  const workerScope = getSyncWorkerScope();
  let completed = 0;
  let emptied = false;
  try {
    while (Date.now() < deadline) {
      const now = new Date();
      const candidate = await prisma.gameMetadataJob.findFirst({
        where: { workerScope, nextAttemptAt: { lte: now }, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }] },
        orderBy: { nextAttemptAt: "asc" },
      });
      if (!candidate) {
        emptied = true;
        break;
      }
      const token = randomUUID();
      const where = { gameId: candidate.gameId, workerScope };
      const claim = await prisma.gameMetadataJob.updateMany({
        where: { ...where, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }] },
        data: { workerToken: token, leaseExpiresAt: new Date(Date.now() + 90_000) },
      });
      if (!claim.count) break;
      try {
        await enrichCatalogGame(candidate.gameId);
        await prisma.gameMetadataJob.deleteMany({ where: { ...where, workerToken: token } });
        completed++;
      } catch {
        await prisma.gameMetadataJob.updateMany({ where: { ...where, workerToken: token }, data: {
          workerToken: null, leaseExpiresAt: null, attempt: { increment: 1 },
          nextAttemptAt: new Date(Date.now() + Math.min(24, 2 ** candidate.attempt) * 60 * 60_000),
        } });
      }
    }
    // Keep going while the deadline, not an empty queue, ended the pass. A pass
    // with only failures waits for cron instead of retrying a failing provider.
    if (completed && !emptied) continueWorker("metadata", hop);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

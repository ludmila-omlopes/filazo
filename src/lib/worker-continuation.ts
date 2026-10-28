import { after } from "next/server";

// Background workers run on a sparse cron so the database can scale to zero
// between windows. Work that is already due continues right away by starting
// the next worker invocation, instead of waiting for the next cron tick.
const WORKER_PATHS = {
  metadata: "/api/internal/game-metadata-worker",
  playstation: "/api/internal/playstation-sync-worker",
  steam: "/api/internal/steam-sync-worker",
} as const;

export type ContinuableWorker = keyof typeof WORKER_PATHS;

export const WORKER_HOP_HEADER = "x-filazo-worker-hop";
// Bounds one chain even if work keeps becoming due; cron resumes it later.
export const MAX_WORKER_HOPS = 60;
const TRIGGER_TIMEOUT_MS = 5_000;

export function readWorkerHop(request: Request) {
  const hop = Number(request.headers.get(WORKER_HOP_HEADER) ?? 0);
  return Number.isSafeInteger(hop) && hop > 0 ? Math.min(hop, MAX_WORKER_HOPS) : 0;
}

/**
 * Starts another invocation of an internal worker after the current response.
 * Returns false when continuation is unavailable; scheduled cron still resumes.
 */
export function continueWorker(worker: ContinuableWorker, hop = 0) {
  const secret = process.env.CRON_SECRET?.trim();
  // Only the configured application URL receives the secret, never a host
  // taken from request headers.
  const origin = process.env.APP_URL?.trim();
  if (!secret || !origin || hop >= MAX_WORKER_HOPS) return false;
  let url: URL;
  try {
    url = new URL(WORKER_PATHS[worker], origin);
  } catch {
    return false;
  }

  after(async () => {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${secret}`, [WORKER_HOP_HEADER]: String(hop + 1) },
        redirect: "manual",
        signal: AbortSignal.timeout(TRIGGER_TIMEOUT_MS),
      });
      await response.body?.cancel();
      if (!response.ok) {
        console.warn("Worker continuation was not accepted; cron will resume it.", { worker, status: response.status });
      }
    } catch (error) {
      // A timeout is expected for long batches. The started invocation keeps
      // running after this caller stops waiting (request cancellation is opt-in).
      if (!(error instanceof Error && error.name === "TimeoutError")) {
        console.warn("Worker continuation could not start; cron will resume it.", { worker });
      }
    }
  });
  return true;
}

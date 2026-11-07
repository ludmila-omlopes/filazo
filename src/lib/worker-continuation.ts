import { after } from "next/server";

// Background workers run in a few sparse windows a day so the database can
// scale to zero in between. Work that is already due continues right away by
// starting the next worker invocation, instead of waiting for the next window.
const WORKER_PATHS = {
  metadata: "/api/internal/game-metadata-worker",
  playstation: "/api/internal/playstation-sync-worker",
  steam: "/api/internal/steam-sync-worker",
} as const;

export type ContinuableWorker = keyof typeof WORKER_PATHS;

export const WORKER_HOP_HEADER = "x-filazo-worker-hop";
// Bounds one chain even if work keeps becoming due; the next window resumes it.
export const MAX_WORKER_HOPS = 60;
const TRIGGER_TIMEOUT_MS = 5_000;

// Steam and PlayStation retry transient failures after 15 s to 2 min. A chain
// waits for such a retry instead of leaving it for a window hours away.
export const SYNC_FOLLOW_UP_MS = 5 * 60_000;
// The wait runs after the response, inside the same invocation (maxDuration 60 s).
export const MAX_CONTINUATION_DELAY_MS = 40_000;

export function readWorkerHop(request: Request) {
  const hop = Number(request.headers.get(WORKER_HOP_HEADER) ?? 0);
  return Number.isSafeInteger(hop) && hop > 0 ? Math.min(hop, MAX_WORKER_HOPS) : 0;
}

/**
 * Starts another invocation of an internal worker after the current response,
 * optionally after a short wait. Returns false when continuation is
 * unavailable; the next scheduled window still resumes the work.
 */
export function continueWorker(worker: ContinuableWorker, hop = 0, delayMs = 0) {
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
    if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${secret}`, [WORKER_HOP_HEADER]: String(hop + 1) },
        redirect: "manual",
        signal: AbortSignal.timeout(TRIGGER_TIMEOUT_MS),
      });
      await response.body?.cancel();
      if (!response.ok) {
        console.warn("Worker continuation was not accepted; the next window will resume it.", { worker, status: response.status });
      }
    } catch (error) {
      // A timeout is expected for long batches. The started invocation keeps
      // running after this caller stops waiting (request cancellation is opt-in).
      if (!(error instanceof Error && error.name === "TimeoutError")) {
        console.warn("Worker continuation could not start; the next window will resume it.", { worker });
      }
    }
  });
  return true;
}

type SyncQueue = { nextDueIn(): Promise<number | null> };

/**
 * After a Steam or PlayStation pass: keep the chain going while work is due
 * now or within SYNC_FOLLOW_UP_MS, then hand imported games to enrichment.
 * An idle scheduled pass (hop 0, nothing done) never starts a chain.
 * Without `startedAt` the next hop starts immediately and does the waiting.
 */
export async function continueSyncQueue(
  worker: "steam" | "playstation",
  queue: SyncQueue,
  { worked, hop = 0, startedAt }: { worked: boolean; hop?: number; startedAt?: number },
) {
  if (!worked && hop === 0) return;
  const dueIn = await queue.nextDueIn();
  if (dueIn !== null && dueIn <= SYNC_FOLLOW_UP_MS) {
    const budget = startedAt === undefined ? 0 : startedAt + MAX_CONTINUATION_DELAY_MS - Date.now();
    continueWorker(worker, hop, Math.max(0, Math.min(dueIn, budget)));
  } else if (worked) {
    continueWorker("metadata");
  }
}

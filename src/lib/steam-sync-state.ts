import { z } from "zod";

export const steamSnapshotSchema = z.object({
  version: z.literal(1),
  // Optional so already queued Steam snapshots remain resumable after deploy.
  pagination: z.object({
    offset: z.number().int().nonnegative(),
    nextPage: z.number().int().positive().nullable(),
  }).optional(),
  games: z.array(z.object({
    providerGameId: z.string().regex(/^\d+$/),
    title: z.string().min(1),
    platformName: z.string().nullish(),
    playtimeMinutes: z.number().nonnegative().nullish(),
    completionPercent: z.number().min(0).max(100).nullish(),
    lastPlayedAt: z.string().datetime().nullable(),
    storeUrl: z.string().nullish(),
    rawData: z.record(z.string(), z.unknown()).optional(),
  })),
});

export const STEAM_WORK_BUDGET_MS = 35_000;
export const STEAM_WORK_LEASE_MS = 90_000;
export const STEAM_BATCH_SIZE = 100;

export function getSyncWorkerScope() {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

export function steamRetryDelay(attempt: number, code: string) {
  if (["AUTH", "CONFIGURATION", "ACCOUNT_MISSING"].includes(code) || attempt >= 5) {
    return null;
  }
  return Math.min(15 * 60_000, 15_000 * 2 ** Math.max(0, attempt - 1));
}

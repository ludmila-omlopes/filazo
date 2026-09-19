import { z } from "zod";

export const playStationSnapshotSchema = z.object({
  version: z.literal(1),
  games: z.array(z.object({
    providerGameId: z.string().min(1),
    providerGameIds: z.array(z.string().min(1)).optional(),
    title: z.string().min(1),
    platformName: z.string().nullish(),
    playtimeMinutes: z.number().nonnegative().nullish(),
    completionPercent: z.number().min(0).max(100).nullish(),
    lastPlayedAt: z.string().datetime().nullable(),
    storeUrl: z.string().nullish(),
    rawData: z.record(z.string(), z.unknown()).optional(),
  })),
});

// Reserve time for the final transaction within the 60-second function limit.
export const PLAYSTATION_WORK_BUDGET_MS = 25_000;
export const PLAYSTATION_WORK_LEASE_MS = 90_000;
export const PLAYSTATION_BATCH_SIZE = 40;

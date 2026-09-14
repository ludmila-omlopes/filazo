import { createHash } from "node:crypto";
import { prisma } from "./prisma";

export function utcDay(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function recordDailyActivity(userId: string, now = new Date()) {
  // ON CONFLICT DO NOTHING keeps concurrent requests and multiple devices unique.
  try {
    await prisma.userDailyActivity.createMany({
      data: [{ userId, day: utcDay(now) }], skipDuplicates: true,
    });
  } catch {
    // Telemetry outages must not break authentication or automatic sync scheduling.
  }
}

export async function recordPlatformError(error: unknown, context: { routePath: string; routeType: string }) {
  try {
    const signature = error instanceof Error ? `${error.name}:${error.message}` : typeof error;
    await prisma.platformError.create({ data: {
      // Framework route template, never the request URL, headers, payload or user ID.
      route: context.routePath.split(/[?#]/, 1)[0].slice(0, 240),
      kind: context.routeType.slice(0, 30),
      fingerprint: createHash("sha256").update(signature).digest("hex").slice(0, 16),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    } });
  } catch {
    // A failed error write must not recursively trigger the request error hook.
  }
}

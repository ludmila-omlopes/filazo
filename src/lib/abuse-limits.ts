import { createHmac } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { AbusePolicy } from "./abuse-policy.ts";
import { getAuthSecret } from "./auth-secret.ts";
import { prisma } from "./prisma.ts";

type LimitResult = { allowed: true } | {
  allowed: false;
  status: 429 | 503;
  retryAfter: number;
};

function abuseTable() {
  // Prisma model queries qualify schema names, but raw queries can retain the
  // connection's default search_path (notably with hosted PostgreSQL).
  const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema") || "public";
  return Prisma.raw(`"${schema.replaceAll('"', '""')}"."AbuseLimitBucket"`);
}

export function abuseBucketKey(policy: AbusePolicy, identity: string) {
  const scope = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
  return createHmac("sha256", getAuthSecret())
    .update(JSON.stringify([scope, policy.name, identity]))
    .digest("hex");
}

export async function consumeAbuseLimit(
  policy: AbusePolicy,
  identity: string,
  db: Pick<PrismaClient, "$queryRaw"> = prisma,
): Promise<LimitResult> {
  if (!Number.isSafeInteger(policy.limit) || policy.limit < 1 ||
      !Number.isSafeInteger(policy.windowSeconds) || policy.windowSeconds < 1) {
    throw new Error("Invalid abuse limit policy.");
  }
  try {
    const key = abuseBucketKey(policy, identity);
    const table = abuseTable();
    // One atomic statement, shared across all workers. Database time avoids
    // clock drift. Blocked attempts neither extend the window nor overflow.
    const [row] = await db.$queryRaw<{ allowed: boolean; retryAfter: number }[]>`
      INSERT INTO ${table} AS bucket ("key", "count", "expiresAt")
      VALUES (${key}, 1, CURRENT_TIMESTAMP + ${policy.windowSeconds} * INTERVAL '1 second')
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN bucket."expiresAt" <= CURRENT_TIMESTAMP THEN 1
          ELSE LEAST(bucket."count" + 1, ${policy.limit + 1}) END,
        "expiresAt" = CASE WHEN bucket."expiresAt" <= CURRENT_TIMESTAMP
          THEN CURRENT_TIMESTAMP + ${policy.windowSeconds} * INTERVAL '1 second'
          ELSE bucket."expiresAt" END
      RETURNING "count" <= ${policy.limit} AS "allowed",
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("expiresAt" - CURRENT_TIMESTAMP))))::integer AS "retryAfter"
    `;
    if (!row) throw new Error("Missing rate limit result.");
    return row.allowed ? { allowed: true } : { allowed: false, status: 429, retryAfter: row.retryAfter };
  } catch {
    // Do not allow an outage to silently disable protection or log identifiers.
    console.error("Abuse limit storage unavailable.", { policy: policy.name });
    return { allowed: false, status: 503, retryAfter: 60 };
  }
}

export async function consumeAbuseLimits(policies: readonly AbusePolicy[], identity: string) {
  for (const policy of policies) {
    const result = await consumeAbuseLimit(policy, identity);
    if (!result.allowed) return result;
  }
  return { allowed: true } as const;
}

export async function pruneAbuseLimits(db: Pick<PrismaClient, "$executeRaw"> = prisma) {
  // Maintenance only, never scan/delete other clients' buckets on user requests.
  const table = abuseTable();
  return db.$executeRaw`
    DELETE FROM ${table} WHERE "key" IN (
      SELECT "key" FROM ${table}
      WHERE "expiresAt" < CURRENT_TIMESTAMP - INTERVAL '1 day'
      ORDER BY "expiresAt" LIMIT 5000 FOR UPDATE SKIP LOCKED
    )
  `;
}

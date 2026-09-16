import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { abuseBucketKey, consumeAbuseLimit, pruneAbuseLimits } from "../../src/lib/abuse-limits.ts";

async function main() {
const url = new URL(process.env.DATABASE_URL!);
assert.match(url.searchParams.get("schema") ?? "", /^steam_sync_test_[a-f0-9]{16}$/);
const db = new PrismaClient({ log: ["error"] });
const otherWorker = new PrismaClient({ log: ["error"] });
const policy = { name: "concurrency-check", limit: 7, windowSeconds: 60 };
try {
  const outcomes = await Promise.all(Array.from({ length: 30 }, (_, index) =>
    consumeAbuseLimit(policy, "same-user", index % 2 ? db : otherWorker),
  ));
  assert.equal(outcomes.filter((result) => result.allowed).length, policy.limit);
  for (const result of outcomes.filter((result) => !result.allowed)) {
    assert.equal(result.status, 429);
    assert.ok(result.retryAfter > 0 && result.retryAfter <= 60);
  }
  const bucket = await db.abuseLimitBucket.findUniqueOrThrow({ where: { key: abuseBucketKey(policy, "same-user") } });
  assert.equal(bucket.count, policy.limit + 1);
  await consumeAbuseLimit(policy, "same-user", db);
  assert.deepEqual((await db.abuseLimitBucket.findUniqueOrThrow({ where: { key: bucket.key } })).expiresAt, bucket.expiresAt);
  assert.equal((await consumeAbuseLimit(policy, "another-user", db)).allowed, true);
  assert.equal((await consumeAbuseLimit({ ...policy, name: "another-feature" }, "same-user", db)).allowed, true);
  const productionKey = abuseBucketKey(policy, "same-user");
  const originalScope = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "different-environment";
  assert.notEqual(abuseBucketKey(policy, "same-user"), productionKey);
  process.env.VERCEL_ENV = originalScope;
  assert.match(bucket.key, /^[a-f0-9]{64}$/);
  await db.abuseLimitBucket.update({ where: { key: bucket.key }, data: { expiresAt: new Date(0) } });
  assert.equal((await consumeAbuseLimit(policy, "same-user", otherWorker)).allowed, true);
  await db.abuseLimitBucket.create({ data: { key: "expired", count: 1, expiresAt: new Date(0) } });
  assert.equal(await pruneAbuseLimits(db), 1);
  assert.ok(await db.abuseLimitBucket.findUnique({ where: { key: bucket.key } }));
  const unavailable = await consumeAbuseLimit(policy, "same-user", {
    $queryRaw: async () => { throw new Error("simulated outage"); },
  } as unknown as Pick<PrismaClient, "$queryRaw">);
  assert.deepEqual(unavailable, { allowed: false, status: 503, retryAfter: 60 });
  console.log("PASS distributed concurrency, identity/feature/environment isolation, expiry, privacy, bounded cleanup and fail-closed behavior.");
} finally {
  await Promise.all([db.$disconnect(), otherWorker.$disconnect()]);
}
}

main().catch(() => {
  console.error("Abuse protection database checks failed.");
  process.exitCode = 1;
});

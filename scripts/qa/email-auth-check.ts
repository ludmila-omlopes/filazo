import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { beginEmailRegistration, confirmEmailRegistration, EmailRegistrationError } from "../../src/lib/email-registration.ts";
import { resolveGoogleIdentity, GoogleIdentityConflict } from "../../src/lib/google-user-linking.ts";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
assert.match(url.searchParams.get("schema") ?? "", /^email_auth_test_[a-f0-9]{16}$/);
const db = new PrismaClient();
async function pending(email: string) {
  let token = "";
  const result = await beginEmailRegistration(db, { email, displayName: "QA", passwordHash: "test-hash" }, async value => { token = value; return { sent: true }; });
  return { token, ...result };
}
const google = (email: string, subject: string) => ({ email, subject, name: "QA", picture: null });
async function main() {
try {
  const email = "double-confirm@example.test";
  const p = await pending(email);
  assert.equal(await db.user.count({ where: { email } }), 0);
  const results = await Promise.allSettled([
    confirmEmailRegistration(db, p.token, p.browserProof),
    confirmEmailRegistration(db, p.token, p.browserProof),
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(await db.user.count({ where: { email } }), 1);
  assert.equal(await db.pendingEmailRegistration.count({ where: { email } }), 0);
  console.log("PASS simultaneous confirmation creates exactly one proven user.");

  const raceEmail = "unique-race@example.test";
  const race = await pending(raceEmail);
  let reachedCreate!: () => void; let releaseCreate!: () => void;
  const reached = new Promise<void>(resolve => { reachedCreate = resolve; });
  const release = new Promise<void>(resolve => { releaseCreate = resolve; });
  // Pause after the transaction's existence check, then let Google win the unique email.
  // Prisma still executes the real INSERT/P2002/rollback; no failed transaction is mocked.
  const pausedDb = new Proxy(db, { get(target, key) {
    if (key === "$transaction") return (run: (tx: unknown) => unknown) => target.$transaction(async tx => run(new Proxy(tx, { get(txTarget, txKey) {
      if (txKey === "user") return new Proxy(txTarget.user, { get(userTarget, userKey) {
        if (userKey === "create") return async (args: Parameters<typeof userTarget.create>[0]) => {
          reachedCreate(); await release; return userTarget.create(args);
        };
        return Reflect.get(userTarget, userKey);
      } });
      return Reflect.get(txTarget, txKey);
    } })), { timeout: 15_000 });
    return Reflect.get(target, key);
  } });
  const confirmation = confirmEmailRegistration(pausedDb, race.token, race.browserProof);
  await reached;
  const winner = await resolveGoogleIdentity(db, google(raceEmail, "unique-race-subject"));
  releaseCreate();
  await assert.rejects(confirmation, (error: unknown) => error instanceof EmailRegistrationError && error.reason === "exists");
  const after = await db.user.findUniqueOrThrow({ where: { id: winner.id } });
  assert.equal(after.passwordHash, null); assert.equal(after.passwordVerifiedAt, null);
  assert.equal(await db.pendingEmailRegistration.count({ where: { email: raceEmail } }), 1);
  console.log("PASS real PostgreSQL P2002 rolls back proof claim and never mutates/authenticates Google winner.");

  const oauthEmail = "oauth-double@example.test";
  const oauth = await Promise.all([
    resolveGoogleIdentity(db, google(oauthEmail, "shared-subject")),
    resolveGoogleIdentity(db, google(oauthEmail, "shared-subject"), { youtube: true }),
  ]);
  assert.equal(oauth[0].id, oauth[1].id); assert.equal(await db.user.count({ where: { email: oauthEmail } }), 1);
  const oauthRow = await db.user.findUniqueOrThrow({ where: { email: oauthEmail } });
  assert.equal(oauthRow.googleSubject, "shared-subject"); assert.equal(oauthRow.youtubeSubject, "shared-subject");
  console.log("PASS concurrent Google/YouTube signin resolves one subject owner in fresh transactions.");

  const verifiedEmail = "verified-link@example.test";
  const proof = await pending(verifiedEmail);
  const user = await confirmEmailRegistration(db, proof.token, proof.browserProof);
  const attempts = await Promise.allSettled([
    resolveGoogleIdentity(db, google(verifiedEmail, "subject-a")),
    resolveGoogleIdentity(db, google(verifiedEmail, "subject-b"), { youtube: true }),
  ]);
  assert.equal(attempts.filter(r => r.status === "fulfilled").length, 1);
  const linked = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.ok(["subject-a", "subject-b"].includes(linked.googleSubject!));
  assert.ok(!linked.youtubeSubject || linked.googleSubject === linked.youtubeSubject);
  console.log("PASS conflicting concurrent subjects cannot override verified account ownership.");

  for (const youtube of [false, true]) {
    const legacyEmail = `legacy-${youtube}@example.test`;
    const legacy = await db.user.create({ data: { email: legacyEmail, passwordHash: "old-hash" } });
    await assert.rejects(resolveGoogleIdentity(db, google(legacyEmail, `legacy-${youtube}`), { youtube }), GoogleIdentityConflict);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: legacy.id } })).googleSubject, null);
  }
  console.log("PASS legacy same-email records are never implicitly linked.");
} finally { await db.$disconnect(); }

}
main().catch(error => { console.error(error); process.exitCode = 1; });

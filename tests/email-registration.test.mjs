import assert from "node:assert/strict";
import test from "node:test";
import { beginEmailRegistration, confirmEmailRegistration, EmailRegistrationError, hashRegistrationProof } from "../src/lib/email-registration.ts";

function fixture() {
  let pending = null;
  let user = null;
  let creates = 0;
  let uniqueRace = false;
  const tx = {
    user: {
      findUnique: async () => user,
      create: async ({ data }) => { if (uniqueRace) throw { code: "P2002" }; creates++; return user = { id: "new-user", ...data }; },
    },
    pendingEmailRegistration: {
      upsert: async ({ create }) => pending = { id: "pending", ...create },
      findFirst: async ({ where }) => pending && pending.tokenHash === where.tokenHash && pending.browserHash === where.browserHash && pending.expiresAt > where.expiresAt.gt ? pending : null,
      deleteMany: async ({ where }) => {
        if (!pending || (where.tokenHash && pending.tokenHash !== where.tokenHash) ||
            (where.browserHash && pending.browserHash !== where.browserHash) ||
            (where.expiresAt && pending.expiresAt <= where.expiresAt.gt)) return { count: 0 };
        pending = null; return { count: 1 };
      },
    },
  };
  const db = { ...tx, $transaction: async (run) => {
    const snapshot = { pending, user, creates };
    try { return await run(tx); } catch (error) { ({ pending, user, creates } = snapshot); throw error; }
  } };
  return { db, get pending() { return pending; }, get user() { return user; }, get creates() { return creates; },
    set user(value) { user = value; }, set uniqueRace(value) { uniqueRace = value; } };
}
const input = { email: "person@example.test", displayName: "Person", passwordHash: "hash-only" };
async function start(f) {
  let token;
  const { browserProof } = await beginEmailRegistration(f.db, input, async (value) => { token = value; return { sent: true }; });
  return { token, browserProof };
}

test("registration stays pending with hashed proofs and no active account until confirmation", async () => {
  const f = fixture(); const { token, browserProof } = await start(f);
  assert.equal(f.user, null); assert.equal(f.creates, 0);
  assert.equal(f.pending.tokenHash, hashRegistrationProof(token));
  assert.equal(f.pending.browserHash, hashRegistrationProof(browserProof));
  assert.equal(JSON.stringify(f.pending).includes(token), false);
  assert.equal(JSON.stringify(f.pending).includes(browserProof), false);
  const user = await confirmEmailRegistration(f.db, token, browserProof);
  assert.equal(user.email, input.email); assert.ok(user.passwordVerifiedAt instanceof Date);
  assert.equal(f.pending, null); assert.equal(f.creates, 1);
  await assert.rejects(confirmEmailRegistration(f.db, token, browserProof), { reason: "invalid" });
});

for (const existing of [{ id: "oauth", passwordHash: null }, { id: "password", passwordHash: "legacy" }]) {
  test(`existing ${existing.id} email cannot acquire unauthenticated credentials`, async () => {
    const f = fixture(); f.user = existing;
    await assert.rejects(beginEmailRegistration(f.db, input, () => assert.fail("must not send")), { reason: "exists" });
    assert.equal(f.user, existing); assert.equal(f.pending, null); assert.equal(f.creates, 0);
  });
}
for (const delivery of [async () => ({ sent: false }), async () => { throw new Error("provider secret"); }]) {
  test("missing mail configuration or failed delivery removes pending attempt and creates no user", async () => {
    const f = fixture(); await assert.rejects(beginEmailRegistration(f.db, input, delivery), { reason: "delivery" });
    assert.equal(f.pending, null); assert.equal(f.user, null);
  });
}
for (const scenario of ["wrong-browser", "unsolicited", "tampered", "expired"]) {
  test(`${scenario} proof cannot write or activate credentials`, async () => {
    const f = fixture(); const { token, browserProof } = await start(f); const pending = f.pending;
    if (scenario === "expired") pending.expiresAt = new Date(0);
    await assert.rejects(confirmEmailRegistration(f.db,
      scenario === "tampered" ? "x".repeat(43) : token,
      scenario === "wrong-browser" ? "y".repeat(43) : scenario === "unsolicited" ? undefined : browserProof), { reason: "invalid" });
    assert.equal(f.pending, pending); assert.equal(f.user, null); assert.equal(f.creates, 0);
  });
}
test("Google winner and uniqueness race never receive the pending password or a user result", async () => {
  for (const uniqueRace of [false, true]) {
    const f = fixture(); const { token, browserProof } = await start(f); const pending = f.pending;
    if (uniqueRace) f.uniqueRace = true;
    else f.user = { id: "google-winner", passwordHash: null };
    await assert.rejects(confirmEmailRegistration(f.db, token, browserProof), { reason: "exists" });
    assert.equal(f.pending, pending); assert.equal(f.creates, 0);
    assert.equal(f.user?.passwordHash ?? null, null);
  }
});
test("re-registration replaces its pending proof; old email cannot confirm the replacement", async () => {
  const f = fixture(); const first = await start(f); const second = await start(f);
  await assert.rejects(confirmEmailRegistration(f.db, first.token, first.browserProof), EmailRegistrationError);
  await confirmEmailRegistration(f.db, second.token, second.browserProof);
  assert.equal(f.creates, 1);
});

test("an older failed send cannot remove a newer same-email registration", async () => {
  const f = fixture(); let failSend; let sentToken;
  const oldAttempt = beginEmailRegistration(f.db, input, async token => {
    sentToken = token;
    return new Promise(resolve => { failSend = resolve; });
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(sentToken);
  const newer = await start(f); const pending = f.pending;
  failSend({ sent: false });
  await assert.rejects(oldAttempt, { reason: "delivery" });
  assert.equal(f.pending, pending);
  await confirmEmailRegistration(f.db, newer.token, newer.browserProof);
  assert.equal(f.creates, 1);
});

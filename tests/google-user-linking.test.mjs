import assert from "node:assert/strict";
import test from "node:test";
import { resolveGoogleIdentity, GoogleIdentityConflict } from "../src/lib/google-user-linking.ts";

const profile = { subject: "trusted-subject", email: "person@example.test", name: "Person", picture: null };
function fixture(rows = [], raceWinner = null, changedDuringWrite = false) {
  const users = rows.map(row => ({ email: profile.email, googleSubject: null, youtubeSubject: null, passwordHash: null, passwordVerifiedAt: null, displayName: null, avatarUrl: null, ...row }));
  let attempts = 0;
  const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
  const tx = { user: {
    findMany: async () => users.filter(u => u.googleSubject === profile.subject || u.youtubeSubject === profile.subject).slice(0, 2),
    findUnique: async ({ where }) => users.find(u => matches(u, where)) ?? null,
    findUniqueOrThrow: async ({ where }) => users.find(u => matches(u, where)),
    create: async ({ data }) => {
      if (raceWinner && attempts === 1) { users.push({ ...raceWinner }); throw { code: "P2002" }; }
      const user = { id: "created", ...data }; users.push(user); return user;
    },
    updateMany: async ({ where, data }) => {
      if (changedDuringWrite) return { count: 0 };
      const u = users.find(u => matches(u, where)); if (!u) return { count: 0 };
      Object.assign(u, data); return { count: 1 };
    },
  } };
  return { users, db: { $transaction: async run => { attempts++; return run(tx); } }, get attempts() { return attempts; } };
}
for (const youtube of [false, true]) {
  for (const row of [
    { id: "legacy", passwordHash: "unverified" },
    { id: "conflict", googleSubject: "another-subject", passwordHash: "hash", passwordVerifiedAt: new Date() },
    { id: "conflict", youtubeSubject: "another-subject", passwordHash: "hash", passwordVerifiedAt: new Date() },
  ]) {
    test(`Google/YouTube ${youtube} rejects legacy email and conflicting ownership (${row.id})`, async () => {
      const f = fixture([row]); const before = structuredClone(f.users);
      await assert.rejects(resolveGoogleIdentity(f.db, profile, { youtube }), GoogleIdentityConflict);
      assert.deepEqual(f.users, before);
    });
  }
  test(`verified password identity can link through Google/YouTube ${youtube}`, async () => {
    const f = fixture([{ id: "verified", passwordHash: "verified", passwordVerifiedAt: new Date() }]);
    assert.equal((await resolveGoogleIdentity(f.db, profile, { youtube })).id, "verified");
    assert.equal(f.users[0].googleSubject, profile.subject);
    assert.equal(f.users[0].youtubeSubject, youtube ? profile.subject : null);
  });
  for (const field of ["googleSubject", "youtubeSubject"]) {
    test(`returning ${field} identity survives Google/YouTube ${youtube}`, async () => {
      const f = fixture([{ id: "returning", [field]: profile.subject }]);
      assert.equal((await resolveGoogleIdentity(f.db, profile, { youtube })).id, "returning");
    });
  }
}
test("duplicate cross-column subjects and mismatched returning identity fail closed", async () => {
  for (const rows of [
    [{ id: "a", googleSubject: profile.subject }, { id: "b", youtubeSubject: profile.subject }],
    [{ id: "a", googleSubject: profile.subject, youtubeSubject: "different" }],
  ]) await assert.rejects(resolveGoogleIdentity(fixture(rows).db, profile), GoogleIdentityConflict);
});
test("conditional subject/provenance write refuses stale ownership", async () => {
  const f = fixture([{ id: "verified", passwordHash: "hash", passwordVerifiedAt: new Date() }], null, true);
  await assert.rejects(resolveGoogleIdentity(f.db, profile), GoogleIdentityConflict);
  assert.equal(f.users[0].googleSubject, null);
});
test("P2002 winner is checked in a fresh transaction; email collision is not trusted", async () => {
  const f = fixture([], { id: "winner", email: profile.email, googleSubject: "different", youtubeSubject: null });
  await assert.rejects(resolveGoogleIdentity(f.db, profile), GoogleIdentityConflict);
  assert.equal(f.attempts, 2); assert.equal(f.users.length, 1);
});

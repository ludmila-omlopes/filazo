import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { SignJWT, jwtVerify } from "jose";

const require = createRequire(import.meta.url);
const secret = new TextEncoder().encode("test-secret-for-session-policy-only");
function load(path, mocks) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {}; new Function("require", "exports", outputText)(name => name in mocks ? mocks[name] : require(name), exports);
  return exports;
}
function fixture({ users = { "trusted-user": { sessionVersion: 0 } }, databaseDown = false } = {}) {
  const cookies = new Map(); const activity = [];
  const lastActiveAt = new Date();
  const prisma = { user: {
    async findUnique({ where }) {
      if (databaseDown) throw new Error("database unavailable");
      const user = users[where.id];
      return user ? { lastActiveAt, ...user } : null;
    },
    async findUniqueOrThrow(args) {
      const user = await this.findUnique(args);
      if (!user) throw new Error("missing user");
      return user;
    },
    async update({ where, data }) {
      users[where.id].sessionVersion += data.sessionVersion.increment;
    },
  } };
  const mocks = {
    "next/headers": { cookies: async () => ({ get: name => cookies.get(name), set: (name, value) => cookies.set(name, { value }), delete: name => cookies.delete(name) }) },
    "jose": { SignJWT, jwtVerify },
    "@/lib/auth-secret": { getAuthSecret: () => new TextDecoder().decode(secret) },
    "@/lib/platform-sync-policy": { PLATFORM_SYNC_INACTIVE_WEEKLY_AFTER_MS: 30 * 86400 * 1000 },
    "@/lib/prisma": { prisma },
    "@/lib/platform-telemetry": { recordDailyActivity: async id => activity.push(id) },
  };
  return { ...load("../src/lib/session.ts", mocks), cookies, activity, users };
}
const sign = (claims, subject = "trusted-user") =>
  new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setSubject(subject).setExpirationTime("1h").sign(secret);

test("signed vulnerable/unknown policy sessions reject before activity tracking", async () => {
  for (const claims of [{}, { authPolicy: "old" }]) {
    const f = fixture(); const value = await sign(claims, "victim");
    f.cookies.set("filazo-session", { value });
    assert.equal(await f.getSessionUserId(), null); assert.deepEqual(f.activity, []);
  }
});
test("all callers issuing sessions receive the new policy and sessions read normally", async () => {
  const f = fixture(); await f.setUserSession("trusted-user");
  const { payload } = await jwtVerify(f.cookies.get("filazo-session").value, secret);
  assert.equal(payload.authPolicy, "email-proof-v1"); assert.equal(payload.sub, "trusted-user");
  assert.equal(payload.sessionVersion, 0);
  assert.equal(await f.getSessionUserId(), "trusted-user");
  assert.deepEqual(f.activity, ["trusted-user", "trusted-user"]);
});
test("revoking sessions invalidates every token issued before, including copied cookies", async () => {
  const f = fixture();
  await f.setUserSession("trusted-user");
  const stolen = f.cookies.get("filazo-session").value;
  await f.revokeAllUserSessions("trusted-user");
  assert.equal(await f.getSessionUserId(), null);
  f.cookies.set("filazo-session", { value: stolen });
  assert.equal(await f.getSessionUserId(), null);

  // Signing in again issues a token for the new version.
  await f.setUserSession("trusted-user");
  assert.equal((await jwtVerify(f.cookies.get("filazo-session").value, secret)).payload.sessionVersion, 1);
  assert.equal(await f.getSessionUserId(), "trusted-user");
});
test("sessions issued before revocation existed stay valid until the first revocation", async () => {
  const f = fixture();
  f.cookies.set("filazo-session", { value: await sign({ authPolicy: "email-proof-v1" }) });
  assert.equal(await f.getSessionUserId(), "trusted-user");
  await f.revokeAllUserSessions("trusted-user");
  assert.equal(await f.getSessionUserId(), null);
});
test("sessions of deleted accounts are rejected", async () => {
  const f = fixture({ users: {} });
  f.cookies.set("filazo-session", { value: await sign({ authPolicy: "email-proof-v1", sessionVersion: 0 }) });
  assert.equal(await f.getSessionUserId(), null);
  assert.deepEqual(f.activity, []);
});
test("a database outage does not turn a valid signed session into a logout", async () => {
  const f = fixture({ databaseDown: true });
  f.cookies.set("filazo-session", { value: await sign({ authPolicy: "email-proof-v1", sessionVersion: 0 }) });
  assert.equal(await f.getSessionUserId(), "trusted-user");
});
test("signing out everywhere revokes the account's sessions and clears this browser", async () => {
  const calls = [];
  const actions = load("../src/app/account/session-actions.ts", {
    "next/navigation": { redirect(url) { throw new Error(`redirect:${url}`); } },
    "@/lib/session": {
      getSessionUserId: async () => "trusted-user",
      revokeAllUserSessions: async (id) => calls.push(["revoke", id]),
      clearUserSession: async () => calls.push(["clear"]),
    },
  });
  await assert.rejects(actions.signOutEverywhereAction(), /redirect:\/$/);
  assert.deepEqual(calls, [["revoke", "trusted-user"], ["clear"]]);
});

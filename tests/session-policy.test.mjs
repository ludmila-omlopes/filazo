import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { SignJWT, jwtVerify } from "jose";

const require = createRequire(import.meta.url);
const secret = new TextEncoder().encode("test-secret-for-session-policy-only");
function fixture() {
  const cookies = new Map(); const activity = [];
  const mocks = {
    "next/headers": { cookies: async () => ({ get: name => cookies.get(name), set: (name, value) => cookies.set(name, { value }), delete: name => cookies.delete(name) }) },
    "jose": { SignJWT, jwtVerify },
    "@/lib/auth-secret": { getAuthSecret: () => new TextDecoder().decode(secret) },
    "@/lib/platform-sync-policy": { PLATFORM_SYNC_INACTIVE_WEEKLY_AFTER_MS: 30 * 86400 * 1000 },
    "@/lib/prisma": { prisma: { user: { findUnique: async () => null } } },
    "@/lib/platform-telemetry": { recordDailyActivity: async id => activity.push(id) },
  };
  const { outputText } = ts.transpileModule(readFileSync(new URL("../src/lib/session.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {}; new Function("require", "exports", outputText)(name => name in mocks ? mocks[name] : require(name), exports);
  return { ...exports, cookies, activity };
}
test("signed vulnerable/unknown policy sessions reject before activity tracking", async () => {
  for (const claims of [{}, { authPolicy: "old" }]) {
    const f = fixture(); const value = await new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setSubject("victim").setExpirationTime("1h").sign(secret);
    f.cookies.set("filazo-session", { value });
    assert.equal(await f.getSessionUserId(), null); assert.deepEqual(f.activity, []);
  }
});
test("all callers issuing sessions receive the new policy and sessions read normally", async () => {
  const f = fixture(); await f.setUserSession("trusted-user");
  const { payload } = await jwtVerify(f.cookies.get("filazo-session").value, secret);
  assert.equal(payload.authPolicy, "email-proof-v1"); assert.equal(payload.sub, "trusted-user");
  assert.equal(await f.getSessionUserId(), "trusted-user");
  assert.deepEqual(f.activity, ["trusted-user", "trusted-user"]);
});

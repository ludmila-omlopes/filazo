import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as policy from "../src/lib/abuse-policy.ts";
import * as bodyReader from "../src/lib/request-body.ts";
import * as uploadLimits from "../src/lib/journal-upload-limits.ts";
import { planCopy } from "../src/lib/plan-copy.ts";

const require = createRequire(import.meta.url);
function load(relativePath, mocks) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(relativePath, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  new Function("require", "exports", outputText)((name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) throw Error(`Unexpected dependency: ${name}`);
    return require(name);
  }, exports);
  return exports;
}

test("login quotas stop password/database work and use normalized email identities", async () => {
  const checked = [];
  const action = load("../src/app/login/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(url) { throw new Error(`redirect:${url}`); } },
    "@/lib/abuse-policy": policy,
    "@/lib/abuse-request": { async checkActionAbuse(policies, identity) {
      checked.push({ name: policies[0].name, identity });
      return policies[0] === policy.ABUSE_LIMITS.loginEmail ? "Too many attempts" : null;
    } },
    "@/lib/password-auth": { normalizeEmail: (email) => email.toLowerCase(), verifyPassword() { assert.fail("password work after denial"); } },
    "@/lib/database-errors": {},
    "@/lib/prisma": { prisma: { user: { findUnique() { assert.fail("database query after denial"); } } } },
    "@/lib/request-locale": { getRequestTranslator: async () => ({ t: (key) => key, locale: "en" }) },
    "@/lib/session": { getSessionUserId: async () => null },
  });
  const form = new FormData();
  form.set("mode", "signin"); form.set("email", " Person@Example.com "); form.set("password", "test-password");
  await assert.rejects(action.emailAuthAction(form), /redirect:.*Too%20many/);
  assert.deepEqual(checked, [{ name: "login-ip", identity: undefined }, { name: "login-email", identity: "person@example.com" }]);
});

test("anonymous support quota denial cannot write a feedback row", async () => {
  const action = load("../src/app/login/actions.ts", {
    "next/cache": {}, "next/navigation": { redirect(url) { throw new Error(url); } },
    "@/lib/abuse-policy": policy, "@/lib/abuse-request": { checkActionAbuse: async () => "wait" },
    "@/lib/password-auth": {}, "@/lib/database-errors": {}, "@/lib/request-locale": {}, "@/lib/session": {},
    "@/lib/prisma": { prisma: { feedback: { create() { assert.fail("feedback write after quota denial"); } } } },
  });
  await assert.rejects(action.submitAuthFailureFeedbackAction(new FormData()), /error=wait/);
});

test("search quota denial precedes provider calls and preserves HTTP 429", async () => {
  const route = load("../src/app/api/profile/game-search/route.ts", {
    "@/lib/queue-game-search": { searchQueueGames() { assert.fail("catalog work after denial"); } },
    "@/lib/prisma": {}, "@/lib/session": { getSessionUserId: async () => "user-a" },
    "@/lib/igdb": { searchIgdbGames() { assert.fail("provider work after denial"); } },
    "@/lib/abuse-policy": policy,
    "@/lib/abuse-request": { checkApiAbuse: async () => new Response(null, { status: 429, headers: { "Retry-After": "60" } }) },
  });
  const response = await route.GET(new Request("https://filazo.app/api/profile/game-search?q=game"));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
});

test("upload quota denies token issuance; accepted image tokens carry size and replay constraints", async () => {
  let denied = true;
  let generated = 0;
  let options;
  const path = "journal/user-a/12345678-1234-1234-1234-123456789012.png";
  const media = load("../src/lib/journal-media.ts", {
    "@vercel/blob": {}, "@/lib/upload-file-type": require("../src/lib/upload-file-type.ts"),
    "./journal-upload-limits": uploadLimits,
  });
  const route = load("../src/app/api/journal/upload/route.ts", {
    "@vercel/blob": {},
    "@vercel/blob/client": { async handleUpload({ body, onBeforeGenerateToken }) {
      options = await onBeforeGenerateToken(body.payload.pathname, body.payload.clientPayload);
      generated++;
      return { type: "blob.generate-client-token", clientToken: "test-token" };
    } },
    "@/lib/journal-media": media,
    "@/lib/ai-settings": { getAiSettings: async () => ({ voiceMaxFileBytes: 1234 }) },
    "@/lib/upload-file-type": require("../src/lib/upload-file-type.ts"),
    "@/lib/session": { getSessionUserId: async () => "user-a" },
    "@/lib/abuse-policy": policy,
    "@/lib/abuse-request": { checkApiAbuse: async (policies, identity) => {
      assert.equal(identity, "user-a");
      return denied && policies[0] === policy.ABUSE_LIMITS.uploadDaily
        ? new Response(null, { status: 429, headers: { "Retry-After": "3600" } }) : null;
    } },
    "@/lib/journal-upload-limits": uploadLimits, "@/lib/request-body": bodyReader,
    "@/lib/plan-access": { getJournalStorage: async () => ({ remaining: 100 * 1024 * 1024 }) },
    "@/lib/plan-copy": { planCopy },
    "@/lib/request-locale": { getRequestLocale: async () => "en" },
  });
  const request = (pathname = path) => new Request("https://filazo.app/api/journal/upload", { method: "POST", body: JSON.stringify({
    type: "blob.generate-client-token", payload: { pathname, clientPayload: JSON.stringify({ kind: "image", pathname }) },
  }) });
  const rejected = await route.POST(request());
  assert.equal(rejected.status, 429);
  assert.equal(rejected.headers.get("retry-after"), "3600");
  assert.equal(generated, 0);
  denied = false;
  assert.equal((await route.POST(request(path.replace("user-a", "user-b")))).status, 400);
  assert.equal(generated, 0);
  assert.equal((await route.POST(request())).status, 200);
  assert.equal(generated, 1);
  assert.equal(options.maximumSizeInBytes, 10 * 1024 * 1024);
  assert.equal(options.allowOverwrite, false);
  assert.equal(options.addRandomSuffix, false);
  assert.ok(options.validUntil > Date.now() && options.validUntil <= Date.now() + 300_000);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";
import { reportAuthFailure } from "../src/lib/auth-errors.ts";
import { createTranslator } from "../src/lib/i18n.ts";

const require = createRequire(import.meta.url);
const { outputText } = ts.transpileModule(
  readFileSync(new URL("../src/app/api/auth/google/callback/route.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } },
);

function callback({ state = "expected-state", nonce = "expected-nonce", locale = "en", exchangeError } = {}) {
  const stored = new Map([
    ["filazo-google-oauth-state", state],
    ["filazo-google-oauth-nonce", nonce],
  ]);
  const events = [];
  const calls = [];
  const mocks = {
    "next/headers": { cookies: async () => ({
      get: (name) => stored.get(name) ? { value: stored.get(name) } : undefined,
      delete: (name) => stored.delete(name),
    }) },
    "@/lib/request-locale": { getRequestTranslator: async () => ({ t: createTranslator(locale) }) },
    "@/lib/auth-errors": { reportAuthFailure: (error, context) => reportAuthFailure(error, context, (safeError, safeContext) => {
      events.push({ message: safeError.message, ...safeContext });
    }) },
    "@/lib/google-auth": {
      exchangeGoogleCodeForProfile: async (input) => {
        calls.push(["exchange", input.code, input.nonce]);
        if (exchangeError) throw exchangeError;
        return { subject: "google-user" };
      },
      upsertGoogleUser: async (profile) => {
        calls.push(["user", profile.subject]);
        return { id: "local-user" };
      },
    },
    "@/lib/session": { setUserSession: async (id) => calls.push(["session", id]) },
  };
  const exports = {};
  new Function("require", "exports", outputText)((name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) throw Error(`Unmocked dependency: ${name}`);
    return require(name);
  }, exports);
  return {
    events, calls, stored,
    run: async (query) => {
      const response = await exports.GET(new Request(`https://filazo.test/api/auth/google/callback?${query}`));
      assert.equal(response.status, 307);
      return new URL(response.headers.get("location"));
    },
  };
}

for (const locale of ["en", "pt-BR"]) {
  test(`denied authorization returns a localized retry message without a server error (${locale})`, async () => {
    const flow = callback({ locale });
    const redirect = await flow.run("state=expected-state&error=access_denied");
    assert.equal(redirect.pathname, "/login");
    assert.equal(redirect.searchParams.get("error"), createTranslator(locale)("auth.error.googleAccessDenied"));
    assert.equal(redirect.searchParams.has("ref"), false);
    assert.deepEqual(flow.events, []);
    assert.deepEqual(flow.calls, []);
    assert.equal(flow.stored.size, 0);
  });
}

for (const [name, options, query] of [
  ["missing state", {}, "error=access_denied"],
  ["mismatched state", {}, "state=wrong&error=access_denied"],
  ["expired state cookie", { state: null }, "state=expected-state&error=access_denied"],
  ["missing nonce", { nonce: null }, "state=expected-state&code=code"],
]) {
  test(`${name} cannot bypass state validation`, async () => {
    const flow = callback(options);
    const redirect = await flow.run(query);
    assert.equal(redirect.pathname, "/login");
    assert.ok(redirect.searchParams.get("ref"));
    assert.equal(flow.events[0].tags["filazo.auth_reason"], "invalid-state");
    assert.deepEqual(flow.calls, []);
  });
}

test("a callback with no code is still reported with a specific reason", async () => {
  const flow = callback();
  const redirect = await flow.run("state=expected-state");
  assert.ok(redirect.searchParams.get("ref"));
  assert.equal(flow.events[0].tags["filazo.auth_reason"], "missing-code");
  assert.deepEqual(flow.calls, []);
});

for (const providerError of ["temporarily_unavailable", "private@example.com", ""]) {
  test(`provider errors remain observable and sanitized (${providerError || "empty"})`, async () => {
    const flow = callback();
    const redirect = await flow.run(new URLSearchParams({
      state: "expected-state", error: providerError, error_description: "private-description", code: "secret-code",
    }));
    assert.ok(redirect.searchParams.get("ref"));
    assert.equal(flow.events[0].tags["filazo.auth_reason"], "provider-error");
    assert.equal(flow.events[0].tags["filazo.oauth_error"], providerError === "temporarily_unavailable" ? providerError : "unknown");
    const output = JSON.stringify(flow.events) + redirect.href;
    for (const secret of ["private@example.com", "private-description", "secret-code", "expected-state", "expected-nonce"]) {
      assert.equal(output.includes(secret), false);
    }
    assert.deepEqual(flow.calls, []);
  });
}

test("a valid callback exchanges the code and creates the user session", async () => {
  const flow = callback();
  const redirect = await flow.run("state=expected-state&code=valid-code");
  assert.equal(redirect.pathname + redirect.search, "/profile?login=google");
  assert.deepEqual(flow.calls, [
    ["exchange", "valid-code", "expected-nonce"],
    ["user", "google-user"],
    ["session", "local-user"],
  ]);
  assert.deepEqual(flow.events, []);
  assert.equal(flow.stored.size, 0);
});

test("token exchange failures still reach monitoring without exposing their contents", async () => {
  const flow = callback({ exchangeError: new Error("secret-token") });
  const redirect = await flow.run("state=expected-state&code=valid-code");
  assert.ok(redirect.searchParams.get("ref"));
  assert.equal(flow.events[0].tags["filazo.auth_stage"], "exchange-code");
  assert.equal(JSON.stringify(flow.events).includes("secret-token"), false);
  assert.deepEqual(flow.calls, [["exchange", "valid-code", "expected-nonce"]]);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as policies from "../src/lib/abuse-policy.ts";
import * as registration from "../src/lib/email-registration.ts";
import { GoogleIdentityConflict } from "../src/lib/google-user-linking.ts";
import { createTranslator } from "../src/lib/i18n.ts";

const require = createRequire(import.meta.url);
function load(path, mocks) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  new Function("require", "exports", outputText)(name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) throw new Error(`Unmocked ${name}`);
    return require(name);
  }, exports);
  return exports;
}
const passwordAuth = load("../src/lib/password-auth.ts", { "@/lib/beta-access": { isAdminEmail: email => email === "admin@example.test" } });

for (const row of [
  { googleSubject: "google", passwordVerifiedAt: null },
  { youtubeSubject: "google", passwordVerifiedAt: null },
  { email: "admin@example.test", passwordVerifiedAt: null },
]) test("unproven OAuth/admin passwords cannot sign in", () => {
  assert.equal(passwordAuth.canSignInWithPassword({ email: "person@example.test", passwordHash: "legacy", googleSubject: null, youtubeSubject: null, ...row }), false);
});
test("ordinary legacy password-only access and verified OAuth credentials remain usable", () => {
  assert.equal(passwordAuth.canSignInWithPassword({ email: "person@example.test", passwordHash: "legacy", passwordVerifiedAt: null, googleSubject: null, youtubeSubject: null }), true);
  assert.equal(passwordAuth.canSignInWithPassword({ email: "admin@example.test", passwordHash: "hash", passwordVerifiedAt: new Date(), googleSubject: "google", youtubeSubject: null }), true);
});

function actionFixture(existing = null, options = {}) {
  const calls = []; const cookies = new Map();
  const db = { user: { findUnique: async () => { calls.push("read-user"); return existing; } } };
  const action = load("../src/app/login/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect: url => { throw new Error(`redirect:${url}`); } },
    "next/headers": { cookies: async () => ({ set: (key, value, attrs) => cookies.set(key, { value, attrs }) }) },
    "@/lib/abuse-policy": policies,
    "@/lib/abuse-request": { checkActionAbuse: async (policies, identity) => {
      calls.push(["quota", policies[0].name, identity]); return options.denyEmail && identity ? "wait" : null;
    } },
    "@/lib/password-auth": { ...passwordAuth, hashPassword: async () => { calls.push("hash"); return "hashed"; }, verifyPassword: async () => { calls.push("verify-password"); return true; } },
    "@/lib/email-registration": { ...registration, beginEmailRegistration: async (_db, input, send) => {
      calls.push(["pending", input]); if (!(await send("t".repeat(43))).sent) throw new registration.EmailRegistrationError("delivery");
      return { browserProof: "b".repeat(43) };
    } },
    "@/lib/email": { sendEmailRegistration: async input => { calls.push(["mail", input.locale]); return { sent: !options.mailMissing }; } },
    "@/lib/database-errors": { reportDatabaseError() {}, getDatabaseErrorMessage: () => "database-error" },
    "@/lib/prisma": { prisma: db },
    "@/lib/request-locale": { getRequestTranslator: async () => ({ t: key => key, locale: "en" }) },
    "@/lib/session": { getSessionUserId: async () => null, setUserSession: async id => calls.push(["session", id]) },
  });
  return { ...action, calls, cookies };
}
function form(mode = "signup") {
  const f = new FormData(); for (const [key, value] of Object.entries({ mode, displayName: "Person", email: " PERSON@example.test ", password: "password1", confirmPassword: "password1", terms: "on" })) f.set(key, value);
  return f;
}
for (const passwordHash of [null, "legacy"]) test("signup action rejects every existing email before password work/session", async () => {
  const f = actionFixture({ id: "existing", passwordHash });
  await assert.rejects(f.emailAuthAction(form()), /auth.error.accountExists/);
  assert.equal(f.calls.includes("hash"), false); assert.equal(f.calls.some(c => c[0] === "session"), false); assert.equal(f.cookies.size, 0);
});
test("signup action sends pending state with secure browser binding and both network/email limits", async () => {
  const f = actionFixture(); await assert.rejects(f.emailAuthAction(form()), /verification=pending/);
  assert.deepEqual(f.calls.filter(c => c[0] === "quota"), [["quota", "login-ip", undefined], ["quota", "registration-email", "person@example.test"]]);
  const binding = f.cookies.get(registration.EMAIL_REGISTRATION_COOKIE);
  assert.equal(binding.attrs.httpOnly, true); assert.equal(binding.attrs.sameSite, "lax"); assert.equal(binding.attrs.path, "/login/verify");
  assert.equal(f.calls.some(c => c[0] === "session"), false);
});
test("signup quota denial and unconfigured mail never create sessions or browser proof", async () => {
  for (const options of [{ denyEmail: true }, { mailMissing: true }]) {
    const f = actionFixture(null, options); await assert.rejects(f.emailAuthAction(form()));
    assert.equal(f.cookies.size, 0); assert.equal(f.calls.some(c => c[0] === "session"), false);
    if (options.denyEmail) assert.equal(f.calls.includes("hash"), false);
  }
});
test("signin action blocks an OAuth's old attached password and unproven admin before password/session work", async () => {
  for (const row of [{ googleSubject: "google" }, { email: "admin@example.test" }]) {
    const f = actionFixture({ id: "existing", email: "person@example.test", passwordHash: "legacy", passwordVerifiedAt: null, googleSubject: null, youtubeSubject: null, ...row });
    await assert.rejects(f.emailAuthAction(form("signin")), /passwordIdentityProof/);
    assert.equal(f.calls.includes("verify-password"), false); assert.equal(f.calls.some(c => c[0] === "session"), false);
  }
});
test("verified password signin creates the intended session", async () => {
  const f = actionFixture({ id: "verified", email: "person@example.test", passwordHash: "hash", passwordVerifiedAt: new Date(), googleSubject: null, youtubeSubject: null });
  await assert.rejects(f.emailAuthAction(form("signin")), /login=signed-in/);
  assert.ok(f.calls.some(c => c[0] === "session" && c[1] === "verified"));
});

test("verification GET renders only a form and never reads/writes the database or session", async () => {
  const page = load("../src/app/login/verify/page.tsx", {
    "next/link": () => {}, "@/components/ui/button": { Button() {} },
    "@/lib/request-locale": { getRequestTranslator: async () => ({ t: key => key }) },
    "@/lib/email-registration": registration,
    "./actions": { confirmEmailRegistrationAction: () => assert.fail("GET must not confirm") },
  });
  const output = await page.default({ searchParams: Promise.resolve({ token: "t".repeat(43) }) });
  assert.equal(output.type, "main");
  const form = output.props.children.find(child => child?.type === "form");
  assert.ok(form);
  assert.equal(form.props.children[0].props.value, "t".repeat(43));
  assert.equal(page.metadata.referrer, "no-referrer");
});

test("confirmation action issues a session only for the newly confirmed identity", async () => {
  for (const valid of [false, true]) {
    const sessions = []; const cookieWrites = [];
    const action = load("../src/app/login/verify/actions.ts", {
      "next/headers": { cookies: async () => ({ get: () => ({ value: "browser-proof" }), set: (...args) => cookieWrites.push(args) }) },
      "next/cache": { revalidatePath() {} }, "next/navigation": { redirect: url => { throw new Error(`redirect:${url}`); } },
      "@/lib/abuse-policy": policies, "@/lib/abuse-request": { checkActionAbuse: async () => null },
      "@/lib/email-registration": { ...registration, confirmEmailRegistration: async () => {
        if (!valid) throw new registration.EmailRegistrationError("invalid"); return { id: "new-proven-user" };
      } },
      "@/lib/prisma": { prisma: {} }, "@/lib/request-locale": { getRequestTranslator: async () => ({ t: key => key }) },
      "@/lib/session": { getSessionUserId: async () => null, setUserSession: async id => sessions.push(id) },
    });
    await assert.rejects(action.confirmEmailRegistrationAction(new FormData()), valid ? /profile\?login=created/ : /verificationInvalid/);
    assert.deepEqual(sessions, valid ? ["new-proven-user"] : []);
    assert.equal(cookieWrites.length, valid ? 1 : 0);
  }
});

test("email delivery fails closed, uses localized proof-only URLs, and sanitizes provider failures", async () => {
  const names = ["RESEND_API_KEY", "EMAIL_AUTH_FROM_EMAIL", "BETA_APPROVAL_FROM_EMAIL", "APP_URL"];
  const baseline = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  try {
    names.forEach(name => delete process.env[name]);
    const email = load("../src/lib/email.ts", { "server-only": {}, "@/lib/beta-community": {}, "@/lib/beta-access": { ADMIN_EMAIL: "admin@example.test" } });
    globalThis.fetch = () => assert.fail("unconfigured mail must not request");
    assert.deepEqual(await email.sendEmailRegistration({ to: "person@example.test", token: "t".repeat(43), locale: "en" }), { sent: false });
    process.env.RESEND_API_KEY = "test-only"; process.env.EMAIL_AUTH_FROM_EMAIL = "filazo@example.test"; process.env.APP_URL = "https://filazo.example.test";
    for (const locale of ["en", "pt-BR"]) {
      let body;
      globalThis.fetch = async (_url, options) => { body = JSON.parse(options.body); return Response.json({ id: "receipt" }); };
      assert.deepEqual(await email.sendEmailRegistration({ to: "person@example.test", token: "t".repeat(43), locale }), { sent: true });
      const proofUrl = new URL(body.text.match(/https:\/\/[^\s]+/)[0]);
      assert.deepEqual([...proofUrl.searchParams.keys()], ["token"]);
      assert.equal(proofUrl.href.includes("person"), false);
      assert.equal(body.subject, locale === "pt-BR" ? "Confirme seu cadastro na filazo" : "Confirm your filazo registration");
    }
    globalThis.fetch = async () => Response.json({ error: "private-provider-body" }, { status: 400 });
    await assert.rejects(email.sendEmailRegistration({ to: "person@example.test", token: "t".repeat(43), locale: "en" }), error => {
      assert.equal(error.message, "Registration email delivery failed."); return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) { if (baseline[name] === undefined) delete process.env[name]; else process.env[name] = baseline[name]; }
  }
});

for (const locale of ["en", "pt-BR"]) test(`YouTube callback identity collision returns localized conflict without session (${locale})`, async () => {
  const sessions = [];
  const stored = new Map([["filazo-youtube-oauth-state", "state"], ["filazo-youtube-oauth-nonce", "nonce"]]);
  const route = load("../src/app/api/auth/youtube/callback/route.ts", {
    "next/headers": { cookies: async () => ({ get: key => ({ value: stored.get(key) }), delete: key => stored.delete(key) }) },
    "@/lib/google-user-linking": { GoogleIdentityConflict },
    "@/lib/beta-access": { createOrUpdateYoutubeBetaUser: async () => { throw new GoogleIdentityConflict(); }, isAdminEmail: () => false },
    "@/lib/google-auth": { exchangeGoogleCodeForProfile: async () => ({ subject: "verified-google" }), getYoutubeRedirectUri: () => "https://filazo.test/callback" },
    "@/lib/request-locale": { getRequestTranslator: async () => ({ t: createTranslator(locale) }) },
    "@/lib/session": { setUserSession: async id => sessions.push(id) },
  });
  const response = await route.GET(new Request("https://filazo.test/api/auth/youtube/callback?code=code&state=state"));
  assert.equal(new URL(response.headers.get("location")).searchParams.get("error"), createTranslator(locale)("auth.error.identityConflict"));
  assert.deepEqual(sessions, []);
});

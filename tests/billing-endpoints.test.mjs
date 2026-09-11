import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import Stripe from "stripe";
import ts from "typescript";

const require = createRequire(import.meta.url);
function loadModule(relativePath, mocks) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  new Function("require", "exports", outputText)((name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) throw Error(`Unmocked dependency ${name}`);
    return require(name);
  }, exports);
  return exports;
}

test("webhook requires an authentic Stripe signature and does not acknowledge failed processing", async () => {
  const stripe = new Stripe("sk_test_not_a_real_key");
  const secret = "whsec_test_local_only";
  const body = JSON.stringify({ id: "evt_test", object: "event", type: "invoice.paid", livemode: false, data: { object: {} } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  let handled = 0;
  let fail = false;
  const { POST } = loadModule("../src/app/api/billing/webhook/route.ts", {
    "@/lib/billing-config": { getBillingConfig: () => ({ secretKey: "sk_test_not_a_real_key", webhookSecret: secret }), getStripe: () => stripe },
    "@/lib/billing-service": { getBillingService: () => ({ handleEvent: async () => { if (fail) throw Error("temporary failure"); handled++; } }) },
  });
  const request = (payload, signed) => new Request("http://localhost/api/billing/webhook", {
    method: "POST", body: payload, headers: signed ? { "stripe-signature": signed } : {},
  });
  assert.equal((await POST(request(body))).status, 400);
  assert.equal((await POST(request(body.replace("evt_test", "evt_tampered"), signature))).status, 400);
  assert.equal(handled, 0);
  assert.equal((await POST(request(body, signature))).status, 200);
  assert.equal(handled, 1);
  fail = true;
  assert.equal((await POST(request(body, signature))).status, 500);
});

function actionsFor(user, access = true) {
  const calls = [];
  const redirect = (url) => { const error = new Error(url); error.url = url; throw error; };
  class BillingError extends Error {}
  const actions = loadModule("../src/app/account/billing/actions.ts", {
    "next/navigation": { redirect }, "next/cache": { revalidatePath: () => {} },
    "@/lib/beta-access": { canAccessPlatform: () => access, getSessionUserWithBeta: async () => user },
    "@/lib/session": { getSessionUserId: async () => user?.id ?? null },
    "@/lib/billing-service": { BillingError, getBillingService: () => ({
      startCheckout: async (id) => { calls.push(["checkout", id]); return "https://checkout.stripe.com/test"; },
      openPortal: async (id) => { calls.push(["portal", id]); return "https://billing.stripe.com/test"; },
      refresh: async (id) => { calls.push(["refresh", id]); },
    }) },
  });
  return { actions, calls };
}
function form() {
  const data = new FormData();
  data.set("brazilConsent", "BR");
  data.set("userId", "victim"); data.set("price", "1"); data.set("customer", "cus_victim");
  return data;
}

test("signed-out requests cannot create checkouts, portal sessions or refresh subscriptions", async () => {
  const { actions, calls } = actionsFor(null);
  for (const name of ["startProCheckoutAction", "manageSubscriptionAction", "refreshSubscriptionAction"]) {
    await assert.rejects(actions[name](form()), (error) => error.url === "/login");
  }
  assert.deepEqual(calls, []);
});

test("checkout requires platform access and recurring-payment consent", async () => {
  const denied = actionsFor({ id: "owner" }, false);
  await assert.rejects(denied.actions.startProCheckoutAction(form()), (e) => e.url === "/beta");
  assert.deepEqual(denied.calls, []);
  const allowed = actionsFor({ id: "owner" });
  await assert.rejects(allowed.actions.startProCheckoutAction(new FormData()), (e) => e.url === "/account/billing?error=consent");
  assert.deepEqual(allowed.calls, []);
});

test("checkout ignores forged user, customer and price fields", async () => {
  const { actions, calls } = actionsFor({ id: "owner" });
  await assert.rejects(actions.startProCheckoutAction(form()), (e) => e.url === "https://checkout.stripe.com/test");
  assert.deepEqual(calls, [["checkout", "owner"]]);
});

test("a user with expired beta access can still manage their own subscription", async () => {
  const { actions, calls } = actionsFor({ id: "owner" }, false);
  await assert.rejects(actions.manageSubscriptionAction(form()), (e) => e.url === "https://billing.stripe.com/test");
  assert.deepEqual(calls, [["portal", "owner"]]);
});

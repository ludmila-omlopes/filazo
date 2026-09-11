import assert from "node:assert/strict";
import { test } from "node:test";
import { createBillingService } from "../src/lib/billing-service.ts";
import { billingLiveMode, isProPrice, subscriptionSnapshot } from "../src/lib/billing-policy.ts";
import { hasProAccess } from "../src/lib/account-plans.ts";

const now = new Date("2026-09-11T12:00:00Z");
const end = Math.floor(new Date("2026-10-11T12:00:00Z").getTime() / 1000);
const price = {
  id: "price_pro", active: true, livemode: false, currency: "brl", unit_amount: 499,
  recurring: { interval: "month", interval_count: 1, usage_type: "licensed" }, billing_scheme: "per_unit",
};
function subscription(overrides = {}) {
  return {
    id: "sub_pro", customer: "cus_owner", livemode: false, status: "active", cancel_at: null, cancel_at_period_end: false,
    items: { data: [{ id: "si_pro", quantity: 1, price, current_period_end: end }] },
    latest_invoice: {
      status: "paid", currency: "brl", parent: { subscription_details: { subscription: "sub_pro" } },
      lines: { data: [{ parent: { subscription_item_details: { subscription_item: "si_pro" } }, period: { end } }] },
    },
    ...overrides,
  };
}
const config = { checkoutEnabled: true, priceId: price.id, livemode: false, portalConfigurationId: "bpc_pro" };

function fixture() {
  const state = {
    customer: { id: "bc_owner", userId: "owner", livemode: false, stripeCustomerId: "cus_owner", checkoutSessionId: null, checkoutAttempt: 0, checkoutPriceId: null },
    manual: "FREE", subscriptions: new Map(), events: new Map(), sessions: new Map(),
    stripeSubscriptions: [], remote: subscription(), creates: [], customerCreates: [], retrieveCalls: 0,
    failSave: false, failEvent: false,
  };
  const tx = {
    $queryRaw: async () => [],
    user: { findUniqueOrThrow: async ({ where }) => { assert.equal(where.id, "owner"); return { id: "owner", plan: state.manual }; } },
    billingCustomer: {
      upsert: async () => ({ ...state.customer }),
      findUnique: async ({ where }) => where.stripeCustomerId && where.stripeCustomerId !== state.customer.stripeCustomerId ? null : { ...state.customer },
      findUniqueOrThrow: async () => ({ ...state.customer }),
      update: async ({ data }) => {
        if (state.failSave && data.checkoutSessionId) { state.failSave = false; throw Error("DB unavailable"); }
        Object.assign(state.customer, data); return { ...state.customer };
      },
    },
    billingSubscription: {
      findUnique: async ({ where }) => state.subscriptions.get(where.id) ?? null,
      upsert: async ({ where, create, update }) => state.subscriptions.set(where.id, state.subscriptions.has(where.id) ? { ...state.subscriptions.get(where.id), ...update } : create),
      update: async ({ where, data }) => state.subscriptions.set(where.id, { ...state.subscriptions.get(where.id), ...data }),
    },
    billingWebhookEvent: {
      findUnique: async ({ where }) => state.events.get(where.id) ?? null,
      create: async ({ data }) => {
        if (state.failEvent) { state.failEvent = false; throw Error("DB unavailable"); }
        state.events.set(data.id, data);
      },
    },
  };
  let queue = Promise.resolve();
  const db = { ...tx, $transaction: (callback) => {
    const run = queue.then(async () => {
      const snapshot = structuredClone({ customer: state.customer, subscriptions: state.subscriptions, events: state.events });
      try { return await callback(tx); } catch (error) { Object.assign(state, snapshot); throw error; }
    });
    queue = run.catch(() => {}); return run;
  } };
  const stripe = {
    prices: { retrieve: async () => price },
    customers: { create: async (params, options) => { state.customerCreates.push({ params, options }); return { id: "cus_owner" }; } },
    subscriptions: {
      list: () => ({ async *[Symbol.asyncIterator]() { yield* state.stripeSubscriptions; } }),
      retrieve: async () => { state.retrieveCalls++; return state.remote; },
    },
    checkout: { sessions: {
      create: async (params, options) => {
        const key = options.idempotencyKey;
        if (!state.sessions.has(key)) {
          state.creates.push({ params, options });
          state.sessions.set(key, { id: `cs_${state.creates.length}`, status: "open", url: "https://checkout.stripe.com/test" });
        }
        return state.sessions.get(key);
      },
      retrieve: async (id) => [...state.sessions.values()].find((session) => session.id === id),
      expire: async (id) => { [...state.sessions.values()].find((s) => s.id === id).status = "expired"; },
    } },
    billingPortal: {
      configurations: { retrieve: async () => ({ id: "bpc_pro", active: true, livemode: false, features: {
        subscription_cancel: { enabled: true, mode: "at_period_end" }, payment_method_update: { enabled: true }, subscription_update: { enabled: false },
      } }) },
      sessions: { create: async ({ customer }) => { assert.equal(customer, "cus_owner"); return { url: "https://billing.stripe.com/test" }; } },
    },
  };
  return { state, stripe, service: createBillingService({ db, stripe, config, returnUrl: "https://filazo.example/account/billing" }) };
}

test("the only supported offer is R$ 4.99 per month", () => {
  assert.equal(isProPrice(price), true);
  for (const change of [{ currency: "usd" }, { unit_amount: 4990 }, { recurring: { ...price.recurring, interval: "year" } }, { recurring: { ...price.recurring, interval_count: 2 } }]) {
    assert.equal(isProPrice({ ...price, ...change }), false);
  }
});

test("a redirect or active-but-unpaid subscription does not grant Pro", () => {
  const unpaid = subscriptionSnapshot(subscription({ latest_invoice: { status: "open" } }), [price.id]);
  assert.equal(unpaid.paidThrough, null);
  assert.equal(hasProAccess({ plan: "FREE", billingSubscriptions: [{ ...unpaid, livemode: false }] }, now, false), false);
  assert.equal(subscriptionSnapshot(subscription(), ["price_other"]), null);
});

test("paid access expires, cancellation at period end preserves it, and failed renewal does not extend it", () => {
  const paid = { ...subscriptionSnapshot(subscription({ cancel_at_period_end: true }), [price.id]), livemode: false };
  assert.equal(hasProAccess({ plan: "FREE", billingSubscriptions: [paid] }, now, false), true);
  assert.equal(hasProAccess({ plan: "FREE", billingSubscriptions: [paid] }, new Date(end * 1000), false), false);
  const failed = subscriptionSnapshot(subscription({ status: "past_due", latest_invoice: { status: "open" } }), [price.id], paid.paidThrough);
  assert.equal(failed.paidThrough.getTime(), end * 1000);
  assert.equal(hasProAccess({ plan: "FREE", billingSubscriptions: [{ ...paid, status: "canceled" }] }, now, false), false);
});

test("manual grants survive billing cancellation, and test subscriptions cannot grant live access", () => {
  const paid = { ...subscriptionSnapshot(subscription(), [price.id]), livemode: false };
  assert.equal(hasProAccess({ plan: "FREE", billingSubscriptions: [paid] }, now, true), false);
  assert.equal(hasProAccess({ plan: "PRO", billingSubscriptions: [{ ...paid, status: "canceled" }] }, now, true), true);
  assert.equal(billingLiveMode({ NODE_ENV: "production", STRIPE_BILLING_MODE: "test" }), true);
  assert.equal(billingLiveMode({ NODE_ENV: "production", VERCEL_ENV: "preview", STRIPE_BILLING_MODE: "test" }), false);
});

test("concurrent checkout clicks reuse one fixed-price BRL session", async () => {
  const { service, state } = fixture();
  const urls = await Promise.all([service.startCheckout("owner"), service.startCheckout("owner")]);
  assert.equal(urls[0], urls[1]); assert.equal(state.creates.length, 1);
  assert.deepEqual(state.creates[0].params.line_items, [{ price: "price_pro", quantity: 1 }]);
  assert.equal(state.creates[0].params.currency, "brl");
  assert.equal(state.creates[0].params.locale, "pt-BR");
  assert.equal(state.creates[0].params.customer, "cus_owner");
  assert.deepEqual(state.creates[0].params.payment_method_types, ["card"]);
});

test("a database failure after Stripe creates a session recovers via the same idempotency key", async () => {
  const { service, state } = fixture();
  state.failSave = true;
  await assert.rejects(service.startCheckout("owner"), /DB unavailable/);
  assert.equal(state.customer.checkoutSessionId, null);
  await service.startCheckout("owner");
  assert.equal(state.creates.length, 1); assert.equal(state.customer.checkoutSessionId, "cs_1");
});

test("a manual grant or existing incomplete subscription prevents another purchase", async () => {
  const { service, state } = fixture();
  state.manual = "PRO";
  await assert.rejects(service.startCheckout("owner"), (e) => e.code === "manual");
  state.manual = "FREE"; state.stripeSubscriptions = [{ status: "incomplete" }];
  await assert.rejects(service.startCheckout("owner"), (e) => e.code === "existing");
  assert.equal(state.creates.length, 0);
});

test("a wrong price or immediate-cancellation portal blocks checkout", async () => {
  const { service, stripe, state } = fixture();
  stripe.prices.retrieve = async () => ({ ...price, currency: "usd" });
  await assert.rejects(service.startCheckout("owner"), (e) => e.code === "unavailable");
  stripe.prices.retrieve = async () => price;
  stripe.billingPortal.configurations.retrieve = async () => ({ active: true, livemode: false, features: { subscription_cancel: { enabled: true, mode: "immediately" } } });
  await assert.rejects(service.startCheckout("owner"), (e) => e.code === "unavailable");
  assert.equal(state.creates.length, 0);
});

test("webhook retries are atomic and duplicate events do not repeat work", async () => {
  const { service, state } = fixture();
  const event = { id: "evt_paid", type: "customer.subscription.updated", livemode: false, data: { object: subscription() } };
  state.failEvent = true;
  await assert.rejects(service.handleEvent(event), /DB unavailable/);
  assert.equal(state.subscriptions.size, 0); assert.equal(state.events.size, 0);
  await service.handleEvent(event);
  const retrieves = state.retrieveCalls;
  await service.handleEvent(event);
  assert.equal(state.retrieveCalls, retrieves); assert.equal(state.events.size, 1);
});

test("out-of-order events use current Stripe state and cannot resurrect a canceled subscription", async () => {
  const { service, state } = fixture();
  const event = { id: "evt_1", type: "customer.subscription.updated", livemode: false, data: { object: subscription() } };
  await service.handleEvent(event);
  state.remote = subscription({ status: "canceled" });
  await service.handleEvent({ ...event, id: "evt_old_active" });
  assert.equal(state.subscriptions.get("sub_pro").status, "canceled");
  assert.equal(state.manual, "FREE");
});

test("a webhook cannot attach another customer's subscription or cross payment modes", async () => {
  const { service, state } = fixture();
  const event = { id: "evt_1", type: "customer.subscription.updated", livemode: false, data: { object: subscription() } };
  state.remote = subscription({ customer: "cus_attacker" });
  await assert.rejects(service.handleEvent(event), /customer mismatch/);
  await assert.rejects(service.handleEvent({ ...event, livemode: true }), /mode mismatch/);
  assert.equal(state.subscriptions.size, 0); assert.equal(state.events.size, 0);
});

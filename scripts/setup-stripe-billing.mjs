import { existsSync } from "node:fs";
import Stripe from "stripe";

if (existsSync(".env")) process.loadEnvFile(".env");
const live = process.argv.includes("--live");
const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key || !(live ? /^(sk|rk)_live_/ : /^(sk|rk)_test_/).test(key)) {
  throw new Error(`Configure a ${live ? "live" : "test"} STRIPE_SECRET_KEY first. Live setup requires --live.`);
}
const stripe = new Stripe(key);
const lookupKey = "filazo_pro_brl_monthly_499";
let price = (await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 })).data[0];
if (!price) {
  const product = await stripe.products.create({
    name: "filazo Pro",
    description: "Apoie o filazo. Recursos exclusivos em preparação.",
    metadata: { app: "filazo" },
  }, { idempotencyKey: "filazo-pro-product-v1" });
  price = await stripe.prices.create({
    product: product.id, currency: "brl", unit_amount: 499,
    recurring: { interval: "month" }, lookup_key: lookupKey,
  }, { idempotencyKey: "filazo-pro-price-brl-499-v1" });
}
if (!price.active || price.currency !== "brl" || price.unit_amount !== 499 ||
    price.recurring?.interval !== "month" || price.recurring.interval_count !== 1) {
  throw new Error("The existing lookup key does not match the monthly R$ 4.99 offer.");
}
let portal;
for await (const candidate of stripe.billingPortal.configurations.list({ limit: 100 })) {
  if (candidate.metadata?.app === "filazo" && candidate.metadata?.version === "1" && candidate.active) {
    portal = candidate; break;
  }
}
if (!portal) {
  portal = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Gerencie sua assinatura filazo Pro" },
    metadata: { app: "filazo", version: "1" },
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: { enabled: false },
    },
  }, { idempotencyKey: "filazo-pro-portal-v1" });
}
console.log(`STRIPE_PRO_MONTHLY_PRICE_ID="${price.id}"`);
console.log(`STRIPE_PORTAL_CONFIGURATION_ID="${portal.id}"`);
console.log(`Configure the webhook endpoint with API version ${Stripe.API_VERSION}.`);
console.log("Keep STRIPE_BILLING_ENABLED=false until webhooks and test payments have been verified.");

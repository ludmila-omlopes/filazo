import Stripe from "stripe";
import { billingLiveMode } from "./billing-policy.ts";

export function getBillingConfig() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const priceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const portalConfigurationId = process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim();
  const livemode = billingLiveMode();
  const validKey = !!secretKey && (livemode ? /^(sk|rk)_live_/ : /^(sk|rk)_test_/).test(secretKey);
  return {
    secretKey: validKey ? secretKey : null,
    priceId, webhookSecret, portalConfigurationId, livemode,
    checkoutEnabled: process.env.STRIPE_BILLING_ENABLED === "true" && validKey &&
      !!priceId && !!webhookSecret && !!portalConfigurationId,
  };
}

export function getStripe() {
  const config = getBillingConfig();
  if (!config.secretKey) throw new Error("Billing is not configured for this environment.");
  return new Stripe(config.secretKey, { timeout: 10_000, maxNetworkRetries: 1 });
}

export function billingReturnUrl() {
  const raw = process.env.APP_URL?.trim();
  if (!raw && process.env.NODE_ENV === "production") throw new Error("APP_URL is required for billing.");
  const url = new URL(raw || "http://localhost:3001");
  if (url.username || url.password || (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new Error("Billing requires an HTTPS application URL.");
  }
  return new URL("/account/billing", url).toString();
}

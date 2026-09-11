import type Stripe from "stripe";

export const PRO_MONTHLY_CENTS = 499;
export const PRO_CURRENCY = "brl";

export function billingLiveMode(env = process.env) {
  // Production access can never be unlocked by test payments.
  if (env.NODE_ENV === "production" && env.VERCEL_ENV !== "preview") return true;
  return env.STRIPE_BILLING_MODE === "live";
}

export function isProPrice(price: Stripe.Price) {
  return price.currency === PRO_CURRENCY && price.unit_amount === PRO_MONTHLY_CENTS &&
    price.recurring?.interval === "month" && price.recurring.interval_count === 1 &&
    price.recurring.usage_type === "licensed" && price.billing_scheme === "per_unit";
}

export function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

export function subscriptionSnapshot(
  subscription: Stripe.Subscription,
  allowedPriceIds: string[],
  previousPaidThrough: Date | null = null,
) {
  const item = subscription.items.data[0];
  const recognized = subscription.items.data.length === 1 && item &&
    allowedPriceIds.includes(item.price.id) && isProPrice(item.price) && item.quantity === 1;
  if (!recognized) return null;

  let paidThrough = previousPaidThrough;
  const invoice = subscription.latest_invoice;
  if (invoice && typeof invoice !== "string" && invoice.status === "paid" &&
      stripeId(invoice.parent?.subscription_details?.subscription) === subscription.id &&
      invoice.currency === PRO_CURRENCY) {
    for (const line of invoice.lines.data) {
      if (line.parent?.subscription_item_details?.subscription_item !== item.id) continue;
      const end = new Date(Math.min(line.period.end, item.current_period_end) * 1000);
      if (!paidThrough || end > paidThrough) paidThrough = end;
    }
  }
  return {
    status: String(subscription.status),
    priceId: item.price.id,
    currentPeriodEnd: new Date(item.current_period_end * 1000),
    paidThrough,
    cancelAtPeriodEnd: subscription.cancel_at_period_end || subscription.cancel_at !== null,
  };
}

export type PaidSubscription = {
  status: string;
  livemode: boolean;
  paidThrough: Date | null;
};

export function hasPaidProAccess(subscription: PaidSubscription, now: Date, livemode: boolean) {
  return subscription.livemode === livemode &&
    ["active", "past_due"].includes(subscription.status) &&
    !!subscription.paidThrough && subscription.paidThrough.getTime() > now.getTime();
}

export function blocksNewSubscription(status: string) {
  return !["canceled", "incomplete_expired"].includes(status);
}

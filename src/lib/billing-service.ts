import type { Prisma, PrismaClient, BillingCustomer } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "./prisma.ts";
import { getBillingConfig, getStripe, billingReturnUrl } from "./billing-config.ts";
import { blocksNewSubscription, isProPrice, stripeId, subscriptionSnapshot } from "./billing-policy.ts";

export class BillingError extends Error {
  readonly code: "unavailable" | "existing" | "manual" | "pending" | "customer";
  constructor(code: BillingError["code"]) {
    super(code);
    this.code = code;
    this.name = "BillingError";
  }
}

type Dependencies = {
  db: PrismaClient;
  stripe: Stripe;
  config: ReturnType<typeof getBillingConfig>;
  returnUrl: string;
};

// Dependency injection keeps payment orchestration testable without charging anyone.
export function createBillingService({ db, stripe, config, returnUrl }: Dependencies) {
  async function lockCustomer(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "BillingCustomer" WHERE "id" = ${id} FOR UPDATE`;
    return tx.billingCustomer.findUniqueOrThrow({ where: { id } });
  }

  async function syncSubscription(tx: Prisma.TransactionClient, customer: BillingCustomer, id: string) {
    // Fetch inside the customer lock: duplicated or out-of-order notifications
    // always converge on Stripe's current state instead of replaying old payloads.
    const subscription = await stripe.subscriptions.retrieve(id, { expand: ["latest_invoice"] });
    if (stripeId(subscription.customer) !== customer.stripeCustomerId ||
        subscription.livemode !== customer.livemode) throw new Error("Subscription customer mismatch.");
    const previous = await tx.billingSubscription.findUnique({ where: { id } });
    if (previous && previous.customerId !== customer.id) throw new Error("Subscription owner mismatch.");
    const snapshot = subscriptionSnapshot(subscription,
      [config.priceId, previous?.priceId].filter((value): value is string => !!value),
      previous?.paidThrough ?? null);
    if (!snapshot) {
      // A dashboard edit to an unsupported product must not leave stale access.
      if (previous) await tx.billingSubscription.update({ where: { id }, data: { status: "unsupported" } });
      return;
    }
    const data = { ...snapshot, userId: customer.userId, customerId: customer.id, livemode: customer.livemode };
    await tx.billingSubscription.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  async function validatePortal() {
    if (!config.portalConfigurationId) throw new BillingError("unavailable");
    const portal = await stripe.billingPortal.configurations.retrieve(config.portalConfigurationId);
    if (!portal.active || portal.livemode !== config.livemode ||
        !portal.features.subscription_cancel.enabled || portal.features.subscription_cancel.mode !== "at_period_end" ||
        !portal.features.payment_method_update.enabled || portal.features.subscription_update.enabled) {
      throw new BillingError("unavailable");
    }
    return portal.id;
  }

  return {
    async startCheckout(userId: string) {
      if (!config.checkoutEnabled || !config.priceId) throw new BillingError("unavailable");
      const price = await stripe.prices.retrieve(config.priceId);
      if (!price.active || price.livemode !== config.livemode || !isProPrice(price)) throw new BillingError("unavailable");
      await validatePortal();
      // Persist this identifier before contacting Stripe. Retries use it to
      // recover the same customer/session even if the DB write later fails.
      const account = await db.billingCustomer.upsert({
        where: { userId_livemode: { userId, livemode: config.livemode } },
        create: { userId, livemode: config.livemode }, update: {},
      });
      return db.$transaction(async (tx) => {
        const customer = await lockCustomer(tx, account.id);
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        if (user.plan === "PRO") throw new BillingError("manual");
        let customerId = customer.stripeCustomerId;
        if (!customerId) {
          const created = await stripe.customers.create({
            metadata: { filazoUserId: userId },
            // Only immutable parameters: retrying after a profile edit must
            // still be able to recover an already-created Stripe customer.
          }, { idempotencyKey: `filazo-customer-${customer.id}` });
          customerId = created.id;
          await tx.billingCustomer.update({ where: { id: customer.id }, data: { stripeCustomerId: customerId } });
        }
        for await (const subscription of stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 })) {
          if (blocksNewSubscription(String(subscription.status))) throw new BillingError("existing");
        }
        let attempt = customer.checkoutAttempt;
        if (customer.checkoutSessionId) {
          const session = await stripe.checkout.sessions.retrieve(customer.checkoutSessionId);
          if (session.status === "open" && customer.checkoutPriceId === price.id && session.url) return session.url;
          if (session.status === "complete") {
            const completedId = stripeId(session.subscription);
            if (!completedId) throw new BillingError("pending");
            const completed = await stripe.subscriptions.retrieve(completedId);
            if (blocksNewSubscription(String(completed.status))) throw new BillingError("existing");
          }
          // A completed checkout may need action on an existing subscription.
          // Terminal subscriptions above do not prevent a new purchase.
          if (session.status === "open") await stripe.checkout.sessions.expire(session.id);
          attempt += 1;
        }
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: customerId,
          client_reference_id: userId,
          line_items: [{ price: price.id, quantity: 1 }],
          currency: "brl",
          locale: "pt-BR",
          payment_method_types: ["card"],
          billing_address_collection: "required",
          customer_update: { address: "auto", name: "auto" },
          adaptive_pricing: { enabled: false },
          subscription_data: { metadata: { filazoUserId: userId } },
          success_url: `${returnUrl}?checkout=success`,
          cancel_url: `${returnUrl}?checkout=canceled`,
          custom_text: { submit: { message: "Pro: R$ 4,99 por mês, com renovação automática. Cancele em Meu plano; o acesso continua até o fim do período pago." } },
        }, { idempotencyKey: `filazo-checkout-${customer.id}-${price.id}-${attempt}` });
        if (!session.url) throw new BillingError("pending");
        await tx.billingCustomer.update({ where: { id: customer.id }, data: {
          checkoutSessionId: session.id, checkoutPriceId: price.id, checkoutAttempt: attempt,
        } });
        return session.url;
      }, { timeout: 60_000, maxWait: 10_000 });
    },

    async openPortal(userId: string) {
      const customer = await db.billingCustomer.findUnique({
        where: { userId_livemode: { userId, livemode: config.livemode } },
      });
      if (!customer?.stripeCustomerId) throw new BillingError("customer");
      const configuration = await validatePortal();
      const portal = await stripe.billingPortal.sessions.create({
        customer: customer.stripeCustomerId, configuration, return_url: returnUrl, locale: "pt-BR",
      });
      return portal.url;
    },

    async refresh(userId: string) {
      const account = await db.billingCustomer.findUnique({
        where: { userId_livemode: { userId, livemode: config.livemode } },
      });
      if (!account?.stripeCustomerId) return;
      await db.$transaction(async (tx) => {
        const customer = await lockCustomer(tx, account.id);
        for await (const subscription of stripe.subscriptions.list({ customer: customer.stripeCustomerId!, status: "all", limit: 100 })) {
          await syncSubscription(tx, customer, subscription.id);
        }
      }, { timeout: 60_000, maxWait: 10_000 });
    },

    async handleEvent(event: Stripe.Event) {
      if (event.livemode !== config.livemode) throw new Error("Webhook mode mismatch.");
      let subscriptionId: string | null = null;
      let customerId: string | null = null;
      if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted",
        "customer.subscription.paused", "customer.subscription.resumed"].includes(event.type)) {
        const subscription = event.data.object as Stripe.Subscription;
        subscriptionId = subscription.id;
        customerId = stripeId(subscription.customer);
      } else if (["invoice.paid", "invoice.payment_failed", "invoice.payment_action_required"].includes(event.type)) {
        const invoice = event.data.object as Stripe.Invoice;
        subscriptionId = stripeId(invoice.parent?.subscription_details?.subscription);
        customerId = stripeId(invoice.customer);
      } else if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") return;
        subscriptionId = stripeId(session.subscription);
        customerId = stripeId(session.customer);
      }
      if (!subscriptionId || !customerId) return;
      const account = await db.billingCustomer.findUnique({ where: { stripeCustomerId: customerId } });
      if (!account) return; // Another product's customer, or a deleted local account.
      await db.$transaction(async (tx) => {
        const customer = await lockCustomer(tx, account.id);
        if (await tx.billingWebhookEvent.findUnique({ where: { id: event.id } })) return;
        await syncSubscription(tx, customer, subscriptionId);
        await tx.billingWebhookEvent.create({ data: { id: event.id, type: event.type, livemode: event.livemode } });
      }, { timeout: 60_000, maxWait: 10_000 });
    },
  };
}

export function getBillingService() {
  return createBillingService({ db: prisma, stripe: getStripe(), config: getBillingConfig(), returnUrl: billingReturnUrl() });
}

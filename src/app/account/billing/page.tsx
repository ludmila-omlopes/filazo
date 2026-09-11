import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingButton } from "./billing-button";
import { PaymentRefresh } from "./payment-refresh";
import { manageSubscriptionAction, refreshSubscriptionAction, startProCheckoutAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { getSessionUserWithBeta, canAccessPlatform } from "@/lib/beta-access";
import { hasProAccess } from "@/lib/account-plans";
import { getBillingConfig } from "@/lib/billing-config";
import { blocksNewSubscription, hasPaidProAccess, PRO_MONTHLY_CENTS } from "@/lib/billing-policy";
import { createTranslator, type TranslationKey } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";
import { noIndexMetadata } from "@/lib/site-metadata";

export const metadata = noIndexMetadata;
export const maxDuration = 60;

const errorKeys: Record<string, TranslationKey> = {
  unavailable: "billing.unavailable", existing: "billing.existing", manual: "billing.manual",
  pending: "billing.pending", customer: "billing.portalError", portal: "billing.portalError", refresh: "billing.refreshError",
  consent: "billing.brazilConfirm",
};
const statusKeys: Record<string, TranslationKey> = {
  active: "billing.active", past_due: "billing.pastDue", unpaid: "billing.pastDue",
  canceled: "billing.canceled", incomplete: "billing.incomplete", incomplete_expired: "billing.canceled",
  paused: "billing.paused", trialing: "billing.incomplete", unsupported: "billing.incomplete",
};

export default async function BillingPage({ searchParams }: {
  searchParams: Promise<{ checkout?: string; error?: string }>;
}) {
  const user = await getSessionUserWithBeta(await getSessionUserId());
  if (!user) redirect("/login");
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const query = await searchParams;
  const config = getBillingConfig();
  const now = new Date();
  const pro = hasProAccess(user, now, config.livemode);
  const subscriptions = user.billingSubscriptions.filter((sub) => sub.livemode === config.livemode)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const paid = subscriptions.find((sub) => hasPaidProAccess(sub, now, config.livemode));
  const subscription = paid ?? subscriptions[0];
  const existingSubscription = subscriptions.some((sub) => blocksNewSubscription(sub.status));
  const customer = await prisma.billingCustomer.findUnique({
    where: { userId_livemode: { userId: user.id, livemode: config.livemode } },
  });
  const price = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(PRO_MONTHLY_CENTS / 100);
  const errorKey = query.error && Object.hasOwn(errorKeys, query.error) ? errorKeys[query.error] : null;
  const waiting = query.checkout === "success" && !paid;

  return <main id="main-content" className="mx-auto grid w-full max-w-[860px] gap-6">
    <PaymentRefresh waiting={waiting} />
    <div className="grid justify-items-start gap-3">
      <Link href="/profile" className="text-sm text-ink-soft underline underline-offset-4">{t("common.library")}</Link>
      <h1 className="text-page-title">{t("billing.title")}</h1>
      <p className="max-w-[60ch] text-ink-soft">{t("billing.description")}</p>
    </div>
    {errorKey ? <Notice tone="error">{t(errorKey)}</Notice> : null}
    {waiting ? <Notice tone="info">{t("billing.pending")}</Notice> : null}
    {query.checkout === "canceled" ? <Notice tone="info">{t("billing.checkoutCanceled")}</Notice> : null}
    <Card tactile>
      <CardContent className="grid gap-5 p-6 max-sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl">{t("billing.currentPlan")}: {t(pro ? "account.plan.pro" : "account.plan.free")}</h2>
          <p className="font-semibold">{t("billing.price", { price })}</p>
        </div>
        <p className="max-w-[60ch] text-sm leading-relaxed text-ink-soft">{t("billing.offer")}</p>
        {user.plan === "PRO" ? <Notice tone="info">{t("billing.manual")}</Notice> : null}
        {subscription ? <div className="grid gap-2 border-t border-edge pt-4 text-sm">
          <p>{t(Object.hasOwn(statusKeys, subscription.status) ? statusKeys[subscription.status] : "billing.incomplete")}</p>
          {paid?.paidThrough ? <p>{t(paid.cancelAtPeriodEnd ? "billing.accessUntil" : "billing.renews", {
            date: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(paid.paidThrough),
          })}</p> : null}
          <p className="text-ink-soft">{t("billing.cancelPolicy")}</p>
        </div> : null}
        {!config.checkoutEnabled && !pro ? <p className="text-sm text-ink-soft">{t("billing.unavailable")}</p> : null}
        {!canAccessPlatform(user) ? <Notice tone="info">{t("billing.betaRequired")}</Notice> : null}
        <div className="flex flex-wrap items-center gap-3">
          {!pro && !existingSubscription ? <form action={startProCheckoutAction} className="grid justify-items-start gap-3">
            <label className="flex max-w-[55ch] items-start gap-2 text-sm text-ink-soft">
              <input type="checkbox" name="brazilConsent" value="BR" required className="mt-1 size-4 shrink-0" />
              <span>{t("billing.brazilConfirm")}</span>
            </label>
            <BillingButton disabled={!config.checkoutEnabled || !canAccessPlatform(user)} pendingLabel={t("billing.opening")}>
              {t("billing.subscribe", { price })}
            </BillingButton>
          </form> : null}
          {customer?.stripeCustomerId ? <>
            <form action={manageSubscriptionAction}>
              <BillingButton disabled={!config.secretKey || !config.portalConfigurationId} pendingLabel={t("billing.opening")}>{t("billing.manage")}</BillingButton>
            </form>
            <form action={refreshSubscriptionAction}>
              <Button type="submit" variant="ghost" disabled={!config.secretKey}>{t("billing.refresh")}</Button>
            </form>
          </> : null}
        </div>
        {!pro ? <p className="text-xs leading-relaxed text-ink-soft">{t("billing.terms")}</p> : null}
      </CardContent>
    </Card>
  </main>;
}

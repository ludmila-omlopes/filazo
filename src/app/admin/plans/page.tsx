import { AdminNav } from "../admin-nav";
import { updateAccountPlanAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { getSessionUserWithBeta, isAdminEmail } from "@/lib/beta-access";
import { createTranslator, type TranslationKey } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";
import { hasProAccess } from "@/lib/account-plans";

const statusKeys: Record<string, TranslationKey> = {
  saved: "admin.plans.saved",
  invalid: "admin.plans.invalid",
  failed: "admin.plans.failed",
  conflict: "admin.plans.conflict",
};

export default async function AccountPlansPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const admin = await getSessionUserWithBeta(await getSessionUserId());
  if (!admin || !isAdminEmail(admin.email)) {
    return <main id="main-content" className="mx-auto w-full max-w-page">
      <Notice tone="error">{t("admin.restricted")}</Notice>
    </main>;
  }

  const query = await searchParams;
  const search = query.q?.trim().slice(0, 100) ?? "";
  const users = search.length >= 2 ? await prisma.user.findMany({
    where: { OR: [
      { id: search },
      { email: { contains: search, mode: "insensitive" } },
      { displayName: { contains: search, mode: "insensitive" } },
    ] },
    select: { id: true, displayName: true, email: true, plan: true, billingSubscriptions: true },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: 20,
  }) : [];
  const statusKey = query.status && Object.hasOwn(statusKeys, query.status)
    ? statusKeys[query.status] : null;

  return (
    <main id="main-content" className="mx-auto grid w-full max-w-page gap-8">
      <section className="grid gap-4">
        <AdminNav current="/admin/plans" locale={locale} />
        <h1 className="text-page-title">{t("admin.plans.title")}</h1>
        <p className="max-w-[62ch] text-ink-soft">{t("admin.plans.body")}</p>
      </section>
      {statusKey ? <Notice tone={query.status === "saved" ? "success" : "error"}>{t(statusKey)}</Notice> : null}
      <Card tactile>
        <CardContent className="grid gap-5 p-6 max-sm:p-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="grid min-w-0 flex-1 basis-64 gap-2">
              <span className="text-sm font-bold">{t("admin.plans.searchLabel")}</span>
              <input type="search" name="q" defaultValue={search} minLength={2} maxLength={100} required
                className="min-h-11 w-full rounded-inner border border-edge bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <Button type="submit">{t("admin.preview.search")}</Button>
          </form>
          {users.map((user) => (
            <div key={user.id} className="grid gap-4 rounded-inner border border-edge p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <h2 className="break-words font-semibold">{user.displayName ?? t("admin.noName")}</h2>
                <p className="break-all text-sm text-ink-soft">{user.email ?? t("admin.noEmail")}</p>
                <p className="mt-2 text-sm">{t("account.plan.label")}: {t(hasProAccess(user) ? "account.plan.pro" : "account.plan.free")}</p>
              </div>
              <form action={updateAccountPlanAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="previousPlan" value={user.plan} />
                <input type="hidden" name="q" value={search} />
                <label className="grid gap-2 text-sm font-bold">
                  <span>{t("admin.plans.changePlan")}</span>
                  <select key={user.plan} name="plan" defaultValue={user.plan}
                    className="min-h-11 rounded-inner border border-edge bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="FREE">{t("account.plan.free")}</option>
                    <option value="PRO">{t("account.plan.pro")}</option>
                  </select>
                </label>
                <Button type="submit" variant="secondary">{t("admin.plans.save")}</Button>
              </form>
            </div>
          ))}
          {search.length >= 2 && !users.length ? <p className="text-sm text-ink-soft">{t("admin.preview.empty")}</p> : null}
          {users.length === 20 ? <p className="text-sm text-ink-soft">{t("admin.plans.refine")}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}

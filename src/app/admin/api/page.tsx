import { AdminNav } from "../admin-nav";
import { ApiTokenManager } from "./api-token-manager";
import { Card, CardContent } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { listApiTokens } from "@/lib/api-tokens";
import { getSessionUserWithBeta, isAdminEmail } from "@/lib/beta-access";
import { createTranslator } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";
import { getSiteUrl } from "@/lib/site-metadata";
import { formatDate } from "@/lib/utils";

export default async function AdminApiPage() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const admin = await getSessionUserWithBeta(await getSessionUserId());
  if (!admin || !isAdminEmail(admin.email)) {
    return <main id="main-content" className="mx-auto w-full max-w-page">
      <Notice tone="error">{t("admin.restricted")}</Notice>
    </main>;
  }

  const tokens = await listApiTokens(admin.id);
  const endpoint = new URL("/api/v1/library", getSiteUrl()).toString();

  return (
    <main id="main-content" className="mx-auto grid w-full max-w-page gap-8">
      <section className="grid gap-4">
        <AdminNav current="/admin/api" locale={locale} />
        <h1 className="text-page-title">{t("admin.api.pageTitle")}</h1>
        <p className="max-w-[62ch] text-ink-soft">{t("admin.api.pageBody")}</p>
      </section>
      <Card tactile>
        <CardContent className="grid gap-6 p-6 max-sm:p-4">
          <ApiTokenManager
            locale={locale}
            tokens={tokens.map((token) => ({
              id: token.id,
              name: token.name,
              prefix: token.prefix,
              meta: t("admin.api.keyMeta", {
                created: formatDate(token.createdAt, locale),
                lastUsed: token.lastUsedAt
                  ? t("admin.api.lastUsed", { date: formatDate(token.lastUsedAt, locale) })
                  : t("admin.api.neverUsed"),
              }),
            }))}
          />
          <details className="text-sm text-ink-soft">
            <summary className="cursor-pointer font-semibold text-ink">
              {t("admin.api.usageTitle")}
            </summary>
            <p className="mt-2 leading-relaxed">{t("admin.api.usageBody")}</p>
            <pre className="mt-3 overflow-x-auto rounded-inner border border-edge bg-surface px-3 py-2 font-mono text-xs text-ink">
              {`curl -H "Authorization: Bearer flz_..." \\\n  "${endpoint}?status=playing"`}
            </pre>
          </details>
        </CardContent>
      </Card>
    </main>
  );
}

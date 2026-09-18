import { AdminAiNav } from "../ai-nav";
import { AdminNav } from "../../admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import {
  AI_FEATURES,
  AUTOMATED_FEATURES,
  type LocalizedText,
} from "@/lib/ai-features";
import { getSessionUserWithBeta, isAdminEmail } from "@/lib/beta-access";
import { isAiFeatureEnabled, getAiSettings } from "@/lib/ai-settings";
import { createTranslator, type Locale } from "@/lib/i18n";
import { isAiProviderConfigured } from "@/lib/openai";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";

function localized(value: LocalizedText, locale: Locale) {
  return value[locale === "pt-BR" ? "pt" : "en"];
}

function modeLabel(mode: (typeof AI_FEATURES)[number]["mode"], locale: Locale) {
  if (mode === "hybrid") {
    return localized(
      { en: "AI + local rules", pt: "IA + regras locais" },
      locale,
    );
  }

  return localized({ en: "Generative AI", pt: "IA generativa" }, locale);
}

function modeVariant(mode: (typeof AI_FEATURES)[number]["mode"]) {
  return mode === "hybrid" ? "lavender" : "sky";
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </dt>
      <dd className="text-sm leading-relaxed text-ink">{value}</dd>
    </div>
  );
}

export default async function AdminAiFeaturesPage() {
  const locale: Locale = await getRequestLocale();
  const t = createTranslator(locale);
  const admin = await getSessionUserWithBeta(await getSessionUserId());

  if (!admin || !isAdminEmail(admin.email)) {
    return (
      <main id="main-content" className="mx-auto grid w-full max-w-[860px] gap-6">
        <Notice tone="error">{t("admin.restricted")}</Notice>
        <Button asChild className="w-fit">
          <a href="/api/auth/youtube?next=/admin/ai/features">
            {t("admin.signInGoogle")}
          </a>
        </Button>
      </main>
    );
  }

  const aiSettings = await getAiSettings();
  const providerConfigured = isAiProviderConfigured();

  return (
    <main id="main-content" className="mx-auto grid w-full max-w-page gap-8">
      <section className="grid gap-4">
        <AdminNav current="/admin/ai" locale={locale} />
        <AdminAiNav current="features" locale={locale} />
        <div className="grid gap-3 pt-2">
          <p className="text-kicker font-bold uppercase text-ink-soft">
            {t("admin.ai.catalog.kicker")}
          </p>
          <h1 className="text-page-title">{t("admin.ai.catalog.title")}</h1>
          <p className="max-w-[72ch] text-ink-soft">
            {t("admin.ai.catalog.body")}
          </p>
        </div>
      </section>

      <Card tactile>
        <CardContent className="grid gap-3 p-6">
          <p className="text-sm font-bold text-ink">
            {t("admin.ai.catalog.legendTitle")}
          </p>
          <p className="max-w-[78ch] text-sm leading-relaxed text-ink-soft">
            {t("admin.ai.catalog.legendBody")}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="sky">{t("admin.ai.catalog.generativeBadge")}</Badge>
            <Badge variant="lavender">{t("admin.ai.catalog.hybridBadge")}</Badge>
            <Badge variant="outline">{t("admin.ai.catalog.dataBadge")}</Badge>
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="ai-feature-list" className="grid gap-4">
        <div>
          <h2 id="ai-feature-list" className="font-display text-2xl font-medium">
            {t("admin.ai.catalog.aiSectionTitle")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {t("admin.ai.catalog.aiSectionBody")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {AI_FEATURES.map((feature) => {
            const enabled = isAiFeatureEnabled(
              aiSettings,
              feature.budgetFeature,
            );
            const statusLabel = !enabled
              ? t("admin.ai.catalog.disabled")
              : providerConfigured
                ? t("admin.ai.catalog.enabled")
                : t("admin.ai.catalog.providerMissing");
            const statusVariant = !enabled
              ? "outline"
              : providerConfigured
                ? "default"
                : "destructive";

            return (
              <article
                className="grid gap-5 rounded-card border border-edge bg-surface p-5 shadow-rest"
                key={feature.id}
              >
                <header className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="ghost">{localized(feature.area, locale)}</Badge>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge variant={modeVariant(feature.mode)}>
                        {modeLabel(feature.mode, locale)}
                      </Badge>
                      <Badge variant={statusVariant}>{statusLabel}</Badge>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-medium leading-tight">
                      {localized(feature.name, locale)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                      {localized(feature.description, locale)}
                    </p>
                  </div>
                </header>

                <dl className="grid gap-4 border-t border-edge pt-4 sm:grid-cols-2">
                  <Field
                    label={t("admin.ai.catalog.when")}
                    value={localized(feature.whenItRuns, locale)}
                  />
                  <Field
                    label={t("admin.ai.catalog.technology")}
                    value={localized(feature.technology, locale)}
                  />
                  <Field
                    label={t("admin.ai.catalog.input")}
                    value={localized(feature.input, locale)}
                  />
                  <Field
                    label={t("admin.ai.catalog.output")}
                    value={localized(feature.output, locale)}
                  />
                </dl>

                <p className="border-t border-edge pt-3 text-xs font-semibold leading-relaxed text-ink-soft">
                  {t("admin.ai.catalog.budget", {
                    feature: feature.budgetFeature,
                  })}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="automated-feature-list" className="grid gap-4">
        <div>
          <p className="text-kicker font-bold uppercase text-ink-soft">
            {t("admin.ai.catalog.relatedKicker")}
          </p>
          <h2
            id="automated-feature-list"
            className="mt-1 font-display text-2xl font-medium"
          >
            {t("admin.ai.catalog.relatedTitle")}
          </h2>
          <p className="mt-1 max-w-[72ch] text-sm leading-relaxed text-ink-soft">
            {t("admin.ai.catalog.relatedBody")}
          </p>
        </div>

        {AUTOMATED_FEATURES.map((feature) => (
          <article
            className="grid gap-5 rounded-card border border-edge bg-canvas p-5"
            key={feature.id}
          >
            <header className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="ghost">{localized(feature.area, locale)}</Badge>
                <Badge variant="outline">
                  {t("admin.ai.catalog.noAiBadge")}
                </Badge>
              </div>
              <div>
                <h3 className="font-display text-2xl font-medium leading-tight">
                  {localized(feature.name, locale)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {localized(feature.description, locale)}
                </p>
              </div>
            </header>

            <dl className="grid gap-4 border-t border-edge pt-4 sm:grid-cols-2">
              <Field
                label={t("admin.ai.catalog.when")}
                value={localized(feature.whenItRuns, locale)}
              />
              <Field
                label={t("admin.ai.catalog.technology")}
                value={localized(feature.technology, locale)}
              />
              <Field
                label={t("admin.ai.catalog.input")}
                value={localized(feature.input, locale)}
              />
              <Field
                label={t("admin.ai.catalog.output")}
                value={localized(feature.output, locale)}
              />
            </dl>
          </article>
        ))}
      </section>

      <Notice tone="info">{t("admin.ai.catalog.note")}</Notice>
    </main>
  );
}

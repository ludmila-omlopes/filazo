import type { Metadata } from "next";
import { createTranslator } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-locale";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ConnectionCheckPage() {
  const t = createTranslator(await getRequestLocale());
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12" id="main-content">
      <section className="panel">
        <h1 className="font-display text-2xl">{t("profile.recovery.checkTitle")}</h1>
        <p className="mt-3 text-ink-soft">{t("profile.recovery.checkBody")}</p>
        <a className="mt-4 inline-block font-semibold underline underline-offset-4" href="/profile">
          {t("profile.recovery.savedLibrary")}
        </a>
      </section>
    </main>
  );
}

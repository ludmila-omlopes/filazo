import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { createTranslator } from "@/lib/i18n";
import { getLegalDocument } from "@/lib/legal-copy";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/site-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const document = getLegalDocument(locale, "terms");

  return createPageMetadata({
    title: document.title,
    description: document.intro[0],
    path: "/terms",
  });
}

export default async function TermsPage() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const document = getLegalDocument(locale, "terms");

  return (
    <LegalPage
      eyebrow={t("footer.tagline")}
      intro={document.intro}
      sections={document.sections}
      title={document.title}
    />
  );
}

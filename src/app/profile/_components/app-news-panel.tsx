import Link from "next/link";
import { ArrowRight, ChevronDown, Newspaper } from "lucide-react";
import { createTranslator, type Locale } from "@/lib/i18n";

export function AppNewsPanel({ locale }: { locale: Locale }) {
  const t = createTranslator(locale);
  const publishedAt = "2026-09-22";
  const publishedDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${publishedAt}T00:00:00Z`));

  return (
    <details className="group min-w-0 rounded-inner border border-edge bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-inner px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <Newspaper aria-hidden="true" className="size-4 shrink-0 text-ink-soft" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
          <span className="text-caption text-ink-soft">{t("profile.news.title")}</span>
          <span className="text-sm font-semibold">{t("profile.news.xbox.title")}</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-soft transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-edge px-4 pb-3 pt-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-caption">
          <span className="rounded-pill border border-edge bg-sage-soft px-2.5 py-0.5 font-bold text-ink">
            {t("profile.news.fix")}
          </span>
          <time dateTime={publishedAt} className="text-ink-soft">
            {publishedDate}
          </time>
        </div>
        <p className="mt-2 max-w-[64ch] text-sm leading-relaxed text-ink-soft">
          {t("profile.news.xbox.body")}
        </p>
        <Link
          href="/profile?tab=integrations"
          className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-inner text-sm font-bold underline decoration-ink/30 underline-offset-4 hover:decoration-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {t("profile.news.sources")}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </details>
  );
}

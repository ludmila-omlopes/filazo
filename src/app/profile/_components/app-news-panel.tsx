import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
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
    <section
      aria-labelledby="app-news-title"
      className="grid min-w-0 gap-5 rounded-card border border-edge bg-surface p-6 max-sm:p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-7"
    >
      <div>
        <Newspaper aria-hidden="true" className="mb-3 size-5 text-ink-soft" />
        <h2 id="app-news-title" className="text-lg font-bold leading-snug">
          {t("profile.news.title")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {t("profile.news.description")}
        </p>
      </div>
      <article
        aria-labelledby="app-news-xbox-title"
        className="min-w-0 border-t border-edge pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-7"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-caption">
          <span className="rounded-pill border border-edge bg-sage-soft px-2.5 py-0.5 font-bold text-ink">
            {t("profile.news.fix")}
          </span>
          <time dateTime={publishedAt} className="text-ink-soft">
            {publishedDate}
          </time>
        </div>
        <h3 id="app-news-xbox-title" className="mt-3 text-base font-bold leading-snug">
          {t("profile.news.xbox.title")}
        </h3>
        <p className="mt-2 max-w-[64ch] text-sm leading-relaxed text-ink-soft">
          {t("profile.news.xbox.body")}
        </p>
        <Link
          href="/profile?tab=integrations"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-inner text-sm font-bold underline decoration-ink/30 underline-offset-4 hover:decoration-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {t("profile.news.sources")}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </article>
    </section>
  );
}

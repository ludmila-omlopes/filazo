import Link from "next/link";
import { createTranslator, type Locale, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", key: "admin.nav.overview" },
  { href: "/admin/beta", key: "admin.nav.beta" },
  { href: "/admin/feedback", key: "admin.nav.feedback" },
  { href: "/admin/ai", key: "admin.nav.ai" },
  { href: "/admin/activity", key: "admin.nav.activity" },
] satisfies Array<{ href: string; key: TranslationKey }>;

export function AdminNav({
  current,
  locale,
}: {
  current: string;
  locale: Locale;
}) {
  const t = createTranslator(locale);

  return (
    <nav
      aria-label={t("admin.nav.label")}
      className="flex flex-wrap items-center gap-2"
    >
      {NAV_ITEMS.map((item) => {
        const active = item.href === current;

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-pill border px-4 py-2 text-sm font-bold transition-colors",
              active
                ? "border-ink bg-ink text-canvas"
                : "border-edge bg-surface text-ink-soft hover:text-ink",
            )}
            href={item.href}
            key={item.href}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}

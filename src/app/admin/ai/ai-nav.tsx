import Link from "next/link";
import { createTranslator, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin/ai/features", key: "admin.ai.featuresTab", value: "features" },
  { href: "/admin/ai", key: "admin.ai.settingsTab", value: "settings" },
] as const;

export function AdminAiNav({
  current,
  locale,
}: {
  current: (typeof ITEMS)[number]["value"];
  locale: Locale;
}) {
  const t = createTranslator(locale);

  return (
    <nav
      aria-label={t("admin.ai.navLabel")}
      className="flex flex-wrap items-center gap-2"
    >
      {ITEMS.map((item) => {
        const active = item.value === current;

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

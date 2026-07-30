"use client";

import {
  CalendarDays,
  Cable,
  Menu,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { LocaleToggle } from "@/components/locale-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { createTranslator, type Locale } from "@/lib/i18n";
import {
  getMobileProfileHref,
  getMobileProfileTab,
} from "@/lib/mobile-navigation";
import type { FilazoThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

const secondaryItems = [
  {
    href: "/profile?tab=integrations",
    tab: "integrations" as const,
    labelKey: "profile.rail.sources" as const,
    icon: Cable,
  },
  {
    href: "/profile?tab=calendar",
    tab: "calendar" as const,
    labelKey: "profile.rail.calendar" as const,
    icon: CalendarDays,
  },
  {
    href: "/profile?tab=player-profile",
    tab: "playerProfile" as const,
    labelKey: "profile.rail.playerProfile" as const,
    icon: UserRound,
  },
  {
    href: "/profile?tab=assistant",
    tab: "assistant" as const,
    labelKey: "profile.rail.guide" as const,
    icon: Sparkles,
  },
  {
    href: "/profile?tab=setup",
    tab: "setup" as const,
    labelKey: "profile.rail.setup" as const,
    icon: SlidersHorizontal,
  },
];

export function MobileAccountMenu({
  displayName,
  isAdmin,
  locale,
  mode,
  signOut,
}: {
  displayName: string;
  isAdmin: boolean;
  locale: Locale;
  mode: FilazoThemeMode;
  signOut: ReactNode;
}) {
  const t = createTranslator(locale);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const currentTab =
    pathname === "/profile" ? getMobileProfileTab(searchParams) : undefined;

  function closeMenu() {
    detailsRef.current?.removeAttribute("open");
  }

  useEffect(() => {
    closeMenu();
  }, [pathname, search]);

  return (
    <details className="group relative lg:hidden" ref={detailsRef}>
      <summary
        aria-label={t("nav.openAccountMenu")}
        className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-inner border border-edge bg-surface text-ink shadow-rest transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas [&::-webkit-details-marker]:hidden"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </summary>

      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 grid w-[min(20rem,calc(100vw-2rem))] gap-4 rounded-card border border-edge bg-surface p-4 shadow-float">
        <div>
          <p className="text-caption font-bold uppercase tracking-wide text-ink-soft">
            {t("nav.account")}
          </p>
          <p className="mt-1 truncate font-display text-lg font-medium">
            {displayName}
          </p>
        </div>

        <nav aria-label={t("nav.secondary")} className="grid gap-1">
          {secondaryItems.map(({ href, tab, labelKey, icon: Icon }) => (
            <Link
              aria-current={currentTab === tab ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-inner px-3 py-2 text-sm font-bold transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                currentTab === tab ? "bg-canvas text-ink" : "text-ink-soft",
              )}
              href={getMobileProfileHref(tab, searchParams)}
              key={href}
              onClick={closeMenu}
            >
              <Icon aria-hidden="true" className="h-4.5 w-4.5" />
              {t(labelKey)}
            </Link>
          ))}
          {isAdmin ? (
            <Link
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-inner px-3 py-2 text-sm font-bold transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                pathname.startsWith("/admin")
                  ? "bg-canvas text-ink"
                  : "text-ink-soft",
              )}
              href="/admin"
              onClick={closeMenu}
            >
              <ShieldCheck aria-hidden="true" className="h-4.5 w-4.5" />
              {t("admin.kicker")}
            </Link>
          ) : null}
        </nav>

        <div className="grid gap-3 border-t border-edge pt-4">
          <LocaleToggle locale={locale} />
          <ThemeToggle mode={mode} />
          {signOut}
        </div>
      </div>
    </details>
  );
}

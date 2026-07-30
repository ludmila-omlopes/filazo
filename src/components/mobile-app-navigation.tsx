"use client";

import {
  Armchair,
  BookOpen,
  LibraryBig,
  MoonStar,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "@/components/locale-provider";
import {
  getMobileNavigationCurrent,
  getMobileProfileHref,
  isMobileProductRoute,
  type MobileNavigationItem,
} from "@/lib/mobile-navigation";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    id: "home" as const,
    href: "/profile",
    labelKey: "profile.rail.home" as const,
    icon: Armchair,
  },
  {
    id: "catalog" as const,
    href: "/profile?tab=games",
    labelKey: "profile.rail.catalog" as const,
    icon: LibraryBig,
  },
  {
    id: "tonight" as const,
    href: "/tonight",
    labelKey: "common.tonight" as const,
    icon: MoonStar,
  },
  {
    id: "journal" as const,
    href: "/profile?tab=journal",
    labelKey: "profile.rail.journal" as const,
    icon: BookOpen,
  },
] satisfies Array<{
  id: MobileNavigationItem;
  href: string;
  labelKey:
    | "profile.rail.home"
    | "profile.rail.catalog"
    | "common.tonight"
    | "profile.rail.journal";
  icon: typeof Armchair;
}>;

export function MobileAppNavigation({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();

  if (!signedIn || !isMobileProductRoute(pathname)) {
    return null;
  }

  const currentItem = getMobileNavigationCurrent(pathname, searchParams);

  return (
    <>
      <div
        aria-hidden="true"
        className="h-[calc(5.25rem+env(safe-area-inset-bottom))] lg:hidden"
      />
      <nav
        aria-label={t("nav.mobilePrimary")}
        className="mobile-app-navigation fixed inset-x-0 bottom-0 z-50 border-t border-edge bg-surface/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-2 shadow-[0_-12px_30px_rgba(52,53,66,0.12)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
          {navigationItems.map(({ id, href, labelKey, icon: Icon }) => {
            const isCurrent = currentItem === id;
            const destination =
              id === "home"
                ? getMobileProfileHref("overview", searchParams)
                : id === "catalog"
                  ? getMobileProfileHref("games", searchParams)
                  : id === "journal"
                    ? getMobileProfileHref("journal", searchParams)
                    : href;

            return (
              <Link
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-inner px-1 py-1.5 text-caption font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  isCurrent
                    ? "bg-ink text-surface night:bg-glow night:text-dusk-deep"
                    : "text-ink-soft hover:bg-canvas hover:text-ink",
                )}
                href={destination}
                key={id}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
                <span className="max-w-full truncate">{t(labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

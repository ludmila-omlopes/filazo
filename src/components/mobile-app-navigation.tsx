"use client";

import {
  Armchair,
  BookOpen,
  CalendarDays,
  Cable,
  LibraryBig,
  Menu,
  MoonStar,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "@/components/locale-provider";
import { InstallAppCard } from "@/components/install-app-card";
import { LocaleToggle } from "@/components/locale-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Locale } from "@/lib/i18n";
import {
  getMobileNavigationCurrent,
  getMobileProfileHref,
  getMobileProfileTab,
  isMobileProductRoute,
  type MobileNavigationItem,
} from "@/lib/mobile-navigation";
import type { FilazoThemeMode } from "@/lib/theme";
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
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) {
      return;
    }

    function updateKeyboardState() {
      const activeElement = document.activeElement;
      const isTextControl =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement?.getAttribute("contenteditable") === "true";
      const obscuredHeight = window.innerHeight - visualViewport!.height;
      const nextKeyboardOpen = isTextControl && obscuredHeight >= 150;

      setIsKeyboardOpen((current) =>
        current === nextKeyboardOpen ? current : nextKeyboardOpen,
      );
    }

    updateKeyboardState();
    visualViewport.addEventListener("resize", updateKeyboardState);
    visualViewport.addEventListener("scroll", updateKeyboardState);
    window.addEventListener("focusin", updateKeyboardState);
    window.addEventListener("focusout", updateKeyboardState);

    return () => {
      visualViewport.removeEventListener("resize", updateKeyboardState);
      visualViewport.removeEventListener("scroll", updateKeyboardState);
      window.removeEventListener("focusin", updateKeyboardState);
      window.removeEventListener("focusout", updateKeyboardState);
    };
  }, []);

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
        aria-hidden={isKeyboardOpen || undefined}
        aria-label={t("nav.mobilePrimary")}
        className="mobile-app-navigation fixed inset-x-0 bottom-0 z-50 border-t border-edge bg-surface/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-2 shadow-[0_-12px_30px_rgba(52,53,66,0.12)] backdrop-blur-md motion-safe:transition-[transform,opacity] data-[keyboard-open=true]:pointer-events-none data-[keyboard-open=true]:translate-y-full data-[keyboard-open=true]:opacity-0 lg:hidden"
        data-keyboard-open={isKeyboardOpen}
        inert={isKeyboardOpen ? true : undefined}
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
  accountAction,
  displayName,
  isAdmin,
  locale,
  mode,
  signedIn,
}: {
  accountAction: ReactNode;
  displayName: string;
  isAdmin: boolean;
  locale: Locale;
  mode: FilazoThemeMode;
  signedIn: boolean;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const layoutFrameRef = useRef<number | null>(null);
  const currentTab =
    pathname === "/profile" ? getMobileProfileTab(searchParams) : undefined;

  const updateMenuBounds = useCallback(() => {
    if (!detailsRef.current?.open) {
      return;
    }

    if (layoutFrameRef.current !== null) {
      window.cancelAnimationFrame(layoutFrameRef.current);
    }

    layoutFrameRef.current = window.requestAnimationFrame(() => {
      const menu = menuRef.current;
      if (!menu) {
        return;
      }

      const visualViewport = window.visualViewport;
      const viewportBottom = visualViewport
        ? visualViewport.offsetTop + visualViewport.height
        : window.innerHeight;
      const bottomNavigation = document.querySelector<HTMLElement>(
        ".mobile-app-navigation",
      );
      const lowerBoundary = Math.min(
        viewportBottom,
        bottomNavigation?.getBoundingClientRect().top ?? viewportBottom,
      );
      const availableHeight = Math.max(
        0,
        Math.floor(lowerBoundary - menu.getBoundingClientRect().top - 12),
      );

      menu.style.setProperty(
        "--mobile-account-menu-max-height",
        `${availableHeight}px`,
      );
    });
  }, []);

  function closeMenu() {
    detailsRef.current?.removeAttribute("open");
  }

  useEffect(() => {
    closeMenu();
  }, [pathname, search]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!detailsRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && detailsRef.current?.hasAttribute("open")) {
        closeMenu();
        detailsRef.current?.querySelector("summary")?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const visualViewport = window.visualViewport;

    window.addEventListener("resize", updateMenuBounds);
    window.addEventListener("scroll", updateMenuBounds, { passive: true });
    visualViewport?.addEventListener("resize", updateMenuBounds);
    visualViewport?.addEventListener("scroll", updateMenuBounds);

    return () => {
      window.removeEventListener("resize", updateMenuBounds);
      window.removeEventListener("scroll", updateMenuBounds);
      visualViewport?.removeEventListener("resize", updateMenuBounds);
      visualViewport?.removeEventListener("scroll", updateMenuBounds);
      if (layoutFrameRef.current !== null) {
        window.cancelAnimationFrame(layoutFrameRef.current);
      }
    };
  }, [updateMenuBounds]);

  return (
    <details
      className="group relative lg:hidden"
      onToggle={updateMenuBounds}
      ref={detailsRef}
    >
      <summary
        aria-label={t("nav.openAccountMenu")}
        className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-inner border border-edge bg-surface text-ink shadow-rest transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas [&::-webkit-details-marker]:hidden"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </summary>

      <div
        className="absolute right-0 top-[calc(100%+0.5rem)] z-50 grid w-[min(20rem,calc(100vw-2rem))] gap-4 overflow-y-auto overscroll-contain rounded-card border border-edge bg-surface p-4 shadow-float"
        ref={menuRef}
        style={{
          maxHeight:
            "var(--mobile-account-menu-max-height, calc(100dvh - var(--beta-banner-h) - 5rem))",
        }}
      >
        <div>
          <p className="text-caption font-bold uppercase tracking-wide text-ink-soft">
            {t("nav.account")}
          </p>
          <p className="mt-1 truncate font-display text-lg font-medium">
            {displayName}
          </p>
        </div>

        {signedIn ? (
          <>
            <nav aria-label={t("nav.secondary")} className="grid gap-1">
              {secondaryItems.map(({ href, tab, labelKey, icon: Icon }) => (
                <Link
                  aria-current={currentTab === tab ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-inner px-3 py-2 text-sm font-bold transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    currentTab === tab
                      ? "bg-canvas text-ink"
                      : "text-ink-soft",
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
                  aria-current={
                    pathname.startsWith("/admin") ? "page" : undefined
                  }
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
            <InstallAppCard />
          </>
        ) : null}

        <div className="grid gap-3 border-t border-edge pt-4 [&_button]:min-h-11 [&_button]:min-w-11 [&_input]:min-h-11">
          <LocaleToggle locale={locale} />
          <ThemeToggle mode={mode} />
          {accountAction}
        </div>
      </div>
    </details>
  );
}

import Link from "next/link";
import {
  Armchair,
  BookOpen,
  Cable,
  CalendarDays,
  LibraryBig,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AvatarImage } from "@/components/avatar-image";
import { createTranslator, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ProfileData, ProfileTab } from "./profile-types";

// Sections people open most sit first with a short hint; setup-style and
// reflective sections are grouped below in a quieter list (progressive
// disclosure instead of eight equally loud destinations).
const dailyItems = [
  {
    tab: "overview" as const,
    href: "/profile",
    labelKey: "profile.rail.home" as const,
    hintKey: "profile.rail.homeHint" as const,
    icon: Armchair,
  },
  {
    tab: "games" as const,
    href: "/profile?tab=games",
    labelKey: "profile.rail.catalog" as const,
    hintKey: "profile.rail.catalogHint" as const,
    icon: LibraryBig,
  },
  {
    tab: "journal" as const,
    href: "/profile?tab=journal",
    labelKey: "profile.rail.journal" as const,
    hintKey: "profile.rail.journalHint" as const,
    icon: BookOpen,
  },
  {
    tab: "calendar" as const,
    href: "/profile?tab=calendar",
    labelKey: "profile.rail.calendar" as const,
    hintKey: "profile.rail.calendarHint" as const,
    icon: CalendarDays,
  },
];

const occasionalItems = [
  {
    tab: "integrations" as const,
    href: "/profile?tab=integrations",
    labelKey: "profile.rail.sources" as const,
    icon: Cable,
  },
  {
    tab: "playerProfile" as const,
    href: "/profile?tab=player-profile",
    labelKey: "profile.rail.playerProfile" as const,
    icon: UserRound,
  },
  {
    tab: "assistant" as const,
    href: "/profile?tab=assistant",
    labelKey: "profile.rail.guide" as const,
    icon: Sparkles,
  },
  {
    tab: "setup" as const,
    href: "/profile?tab=setup",
    labelKey: "profile.rail.setup" as const,
    icon: SlidersHorizontal,
  },
];

const railLinkFocus =
  "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

export function ProfileRail({
  activeTab,
  locale,
  profile,
  viewAsUserId,
}: {
  activeTab: ProfileTab;
  locale: Locale;
  profile: ProfileData;
  viewAsUserId?: string | null;
}) {
  const t = createTranslator(locale);
  const displayName = profile.user.displayName ?? t("common.player");

  function getTabHref(href: string) {
    if (!viewAsUserId) {
      return href;
    }

    const [pathname, search = ""] = href.split("?");
    const params = new URLSearchParams(search);
    params.set("viewAs", viewAsUserId);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <aside className="sticky top-28 grid gap-4 self-start max-lg:hidden">
      <div className="relative overflow-hidden rounded-card border border-edge bg-dusk-deep p-6 text-cream shadow-rest">
        <div aria-hidden className="absolute inset-x-0 top-0 h-2 bg-glow" />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(135deg,rgba(159,153,209,0.16),rgba(219,170,215,0.1)_54%,rgba(255,227,179,0.12))]"
        />
        <div className="relative">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-inner border border-cream/25 bg-cream/12 font-display text-2xl">
            <AvatarImage
              alt={t("profile.rail.avatarAlt", { name: displayName })}
              className="h-full w-full object-cover"
              name={displayName}
              src={profile.user.avatarUrl}
            />
          </div>
          <p className="mt-4 truncate font-display text-xl font-medium">
            {displayName}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-cream/55">
            {t("profile.rail.catalogMood")}
          </p>
        </div>
      </div>

      <nav
        className="grid gap-1 rounded-card border border-edge bg-surface p-2 shadow-rest"
        aria-label={t("nav.profileSections")}
      >
        <p className="px-4 pb-1 pt-2 text-micro font-bold uppercase tracking-[0.14em] text-ink-soft">
          {t("profile.rail.groupDaily")}
        </p>
        {dailyItems.map(({ tab, href, labelKey, hintKey, icon: Icon }) => {
          const isActive = activeTab === tab;

          return (
            <Link
              href={getTabHref(href)}
              key={tab}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[20px] px-4 py-3",
                railLinkFocus,
                isActive
                  ? "bg-ink text-surface shadow-rest"
                  : "text-ink-soft hover:bg-canvas hover:text-ink",
              )}
            >
              <Icon className="h-4.5 w-4.5 flex-none opacity-80" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-bold leading-tight">
                  {t(labelKey)}
                  {tab === "calendar" ? (
                    <span className="rounded-pill bg-dusk-lavender-soft px-2 py-0.5 text-micro font-bold uppercase tracking-[0.08em] text-ink">
                      Pro
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "block text-caption leading-tight",
                    isActive ? "text-surface/60" : "text-ink-soft/70",
                  )}
                >
                  {t(hintKey)}
                </span>
              </span>
            </Link>
          );
        })}

        <div aria-hidden className="mx-4 my-2 h-px bg-edge" />
        <p className="px-4 pb-1 text-micro font-bold uppercase tracking-[0.14em] text-ink-soft">
          {t("profile.rail.groupOccasional")}
        </p>
        {occasionalItems.map(({ tab, href, labelKey, icon: Icon }) => {
          const isActive = activeTab === tab;

          return (
            <Link
              href={getTabHref(href)}
              key={tab}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-[20px] px-4 py-2 text-sm",
                railLinkFocus,
                isActive
                  ? "bg-ink font-bold text-surface shadow-rest"
                  : "text-ink-soft hover:bg-canvas hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4 flex-none opacity-70" />
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>

      <p className="px-4 text-center font-display text-sm italic text-ink-soft/80 max-lg:hidden">
        {t("footer.tagline")}
      </p>
    </aside>
  );
}

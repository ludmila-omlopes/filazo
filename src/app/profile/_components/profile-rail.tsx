import Link from "next/link";
import {
  Armchair,
  BookOpen,
  Cable,
  LibraryBig,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from "lucide-react";
import { createTranslator, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ProfileData, ProfileTab } from "./profile-types";

const railItems = [
  {
    tab: "overview" as const,
    href: "/profile",
    labelKey: "profile.rail.home" as const,
    hintKey: "profile.rail.homeHint" as const,
    icon: Armchair,
  },
  {
    tab: "integrations" as const,
    href: "/profile?tab=integrations",
    labelKey: "profile.rail.sources" as const,
    hintKey: "profile.rail.sourcesHint" as const,
    icon: Cable,
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
    tab: "playerProfile" as const,
    href: "/profile?tab=player-profile",
    labelKey: "profile.rail.playerProfile" as const,
    hintKey: "profile.rail.playerProfileHint" as const,
    icon: UserRound,
  },
  {
    tab: "assistant" as const,
    href: "/profile?tab=assistant",
    labelKey: "profile.rail.guide" as const,
    hintKey: "profile.rail.guideHint" as const,
    icon: Sparkles,
  },
  {
    tab: "setup" as const,
    href: "/profile?tab=setup",
    labelKey: "profile.rail.setup" as const,
    hintKey: "profile.rail.setupHint" as const,
    icon: SlidersHorizontal,
  },
];

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
    <aside className="sticky top-28 grid gap-4 self-start max-lg:static">
      <div className="relative overflow-hidden rounded-card border border-edge bg-dusk-deep p-6 text-cream shadow-rest">
        <div aria-hidden className="absolute inset-x-0 top-0 h-2 bg-glow" />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(135deg,rgba(159,153,209,0.16),rgba(219,170,215,0.1)_54%,rgba(255,227,179,0.12))]"
        />
        <div className="relative">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-inner border border-cream/25 bg-cream/12 font-display text-2xl">
            {profile.user.avatarUrl ? (
              <img
                alt={t("profile.rail.avatarAlt", {
                  name: profile.user.displayName ?? t("common.player"),
                })}
                src={profile.user.avatarUrl}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{(profile.user.displayName ?? "P").slice(0, 1)}</span>
            )}
          </div>
          <h1 className="mt-4 truncate font-display text-xl font-medium">
            {profile.user.displayName ?? t("common.player")}
          </h1>
            <p className="mt-1 text-xs leading-relaxed text-cream/55">
              {t("profile.rail.catalogMood")}
            </p>
        </div>
      </div>

      <nav
        className="grid gap-1 rounded-card border border-edge bg-surface p-2 shadow-rest"
        aria-label={t("nav.profileSections")}
      >
        {railItems.map(({ tab, href, labelKey, hintKey, icon: Icon }) => {
          return (
            <Link
              href={getTabHref(href)}
              key={tab}
              aria-current={activeTab === tab ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[20px] px-4 py-3 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
                activeTab === tab
                  ? "bg-ink text-surface shadow-rest"
                  : "text-ink-soft hover:bg-canvas hover:text-ink",
              )}
            >
              <Icon className="h-4.5 w-4.5 flex-none opacity-80" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold leading-tight">
                  {t(labelKey)}
                </span>
                <span
                  className={cn(
                    "block text-caption leading-tight",
                    activeTab === tab ? "text-surface/60" : "text-ink-soft/70",
                  )}
                >
                  {t(hintKey)}
                </span>
              </span>
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

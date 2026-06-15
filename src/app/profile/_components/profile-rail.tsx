import Link from "next/link";
import { Armchair, LibraryBig, Sparkles } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import type { AssistantData, ProfileData, ProfileTab } from "./profile-types";

const railItems = [
  {
    tab: "overview" as const,
    href: "/profile",
    label: "Overview",
    hint: "Profile and sources",
    icon: Armchair,
  },
  {
    tab: "games" as const,
    href: "/profile?tab=games",
    label: "Catalog",
    hint: "Browse every entry",
    icon: LibraryBig,
  },
  {
    tab: "assistant" as const,
    href: "/profile?tab=assistant",
    label: "Guide",
    hint: "Suggestions and notes",
    icon: Sparkles,
  },
];

export function ProfileRail({
  activeTab,
  assistant,
  profile,
}: {
  activeTab: ProfileTab;
  assistant: AssistantData | null;
  profile: ProfileData;
}) {
  const gamesCount =
    profile.ownedEntries.length + profile.wishlistEntries.length;

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
                alt={`${profile.user.displayName ?? "User"} avatar`}
                src={profile.user.avatarUrl}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{(profile.user.displayName ?? "P").slice(0, 1)}</span>
            )}
          </div>
          <h1 className="mt-4 truncate font-display text-xl font-medium">
            {profile.user.displayName ?? "Player"}
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-cream/55">
            {formatNumber(profile.ownedEntries.length)} owned {" / "}
            {formatNumber(profile.wishlistEntries.length)} still curious
          </p>
        </div>
      </div>

      <nav
        className="grid gap-1 rounded-card border border-edge bg-surface p-2 shadow-rest"
        aria-label="Profile sections"
      >
        {railItems.map(({ tab, href, label, hint, icon: Icon }) => {
          const count =
            tab === "games"
              ? gamesCount
              : tab === "assistant"
                ? assistant?.insights.length ?? null
                : null;

          return (
            <Link
              href={href}
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
                  {label}
                </span>
                <span
                  className={cn(
                    "block text-caption leading-tight",
                    activeTab === tab ? "text-surface/60" : "text-ink-soft/70",
                  )}
                >
                  {hint}
                </span>
              </span>
              {count !== null ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[0.68rem] font-bold",
                    activeTab === tab
                      ? "bg-surface/20 text-surface"
                      : "bg-canvas text-ink-soft",
                  )}
                >
                  {formatNumber(count)}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <p className="px-4 text-center font-display text-sm italic text-ink-soft/80 max-lg:hidden">
        your catalog, your pace
      </p>
    </aside>
  );
}

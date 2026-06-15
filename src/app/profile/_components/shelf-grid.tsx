import Link from "next/link";
import { LayoutGrid, List, Search } from "lucide-react";
import { GameCard } from "@/components/game-card";
import { SyncActionForm } from "@/components/sync-action-form";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { getAssistantSignalDisplayLabel, getStatusDisplayLabel } from "@/lib/copy";
import type { ProfileGameSort } from "@/lib/profile-games";
import { cn, formatDate } from "@/lib/utils";
import {
  detectFinishedGamesAction,
  syncSteamLibraryAction,
} from "../actions";
import { FavoriteButton } from "./favorite-button";
import type { ProfileData, ProfileEntry, ShelfFilters } from "./profile-types";

type GamesView = "grid" | "list";

function makeShelfHref({
  activeSignal,
  platform,
  queryText,
  sort,
  status,
  view,
}: {
  activeSignal: ShelfFilters["activeSignal"];
  platform?: string | null;
  queryText?: string;
  sort: ProfileGameSort;
  status?: string | null;
  view: GamesView;
}) {
  const params = new URLSearchParams({ tab: "games", view, sort });

  if (activeSignal) {
    params.set("signal", activeSignal);
  }

  if (status) {
    params.set("status", status);
  }

  if (platform) {
    params.set("platform", platform);
  }

  if (queryText) {
    params.set("q", queryText);
  }

  return `/profile?${params.toString()}`;
}

function statusForEntry(entry: ProfileEntry) {
  return entry.finishedAt && entry.status !== "COMPLETED"
    ? "FINISHED"
    : entry.status;
}

function ShelfCard({
  entry,
  view,
}: {
  entry: ProfileEntry;
  view: GamesView;
}) {
  if (view === "list") {
    return (
      <div
        className="grid scroll-mt-28 grid-cols-[minmax(0,1fr)_44px] items-center gap-3 target:rounded-card target:ring-2 target:ring-sky"
        id={`entry-${entry.id}`}
      >
        <GameCard
          game={entry.game}
          platformName={entry.platformName}
          playtimeMinutes={entry.playtimeMinutes}
          completionPercent={entry.completionPercent}
          status={statusForEntry(entry)}
          variant="row"
        />
        <FavoriteButton
          entryId={entry.id}
          gameName={entry.game.name}
          isFavorite={entry.isFavorite}
        />
      </div>
    );
  }

  return (
    <div
      className="grid scroll-mt-28 gap-2 target:rounded-card target:ring-2 target:ring-sky"
      id={`entry-${entry.id}`}
    >
      <GameCard
        game={entry.game}
        platformName={entry.platformName}
        playtimeMinutes={entry.playtimeMinutes}
        completionPercent={entry.completionPercent}
        status={statusForEntry(entry)}
        variant="shelf"
      />
      <FavoriteButton
        entryId={entry.id}
        gameName={entry.game.name}
        isFavorite={entry.isFavorite}
        fullWidth
      />
    </div>
  );
}

export function ShelfGrid({
  allEntries,
  filters,
  gamesSort,
  gamesView,
  profile,
  visibleEntries,
}: {
  allEntries: ProfileEntry[];
  filters: ShelfFilters;
  gamesSort: ProfileGameSort;
  gamesView: GamesView;
  profile: ProfileData;
  visibleEntries: ProfileEntry[];
}) {
  const statuses = Array.from(new Set(allEntries.map((entry) => entry.status)));
  const platforms = Array.from(
    new Set(
      allEntries
        .map((entry) => entry.platformName)
        .filter((platform): platform is string => Boolean(platform)),
    ),
  ).slice(0, 8);
  const { activePlatform, activeSignal, activeStatus, queryText } = filters;

  return (
    <>
      <section className="panel">
        <SectionHeader
          eyebrow="The catalog"
          title="Browse every entry"
          aside={
            <div className="pill">
              {visibleEntries.length}{" "}
              {visibleEntries.length === 1 ? "game" : "games"}
            </div>
          }
        />

        <div className="grid gap-5">
          <form
            action="/profile"
            className="grid grid-cols-[1fr_auto] gap-3 max-sm:grid-cols-1"
          >
            <input type="hidden" name="tab" value="games" />
            <input type="hidden" name="view" value={gamesView} />
            <input type="hidden" name="sort" value={gamesSort} />
            {activeSignal ? (
              <input type="hidden" name="signal" value={activeSignal} />
            ) : null}
            {activeStatus ? (
              <input type="hidden" name="status" value={activeStatus} />
            ) : null}
            {activePlatform ? (
              <input type="hidden" name="platform" value={activePlatform} />
            ) : null}
            <label className="relative">
              <span className="sr-only">Search your catalog</span>
              <Search
                aria-hidden
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
              />
              <input
                className="min-h-11 w-full rounded-pill border border-edge bg-surface px-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                defaultValue={queryText}
                name="q"
                placeholder="Search your catalog"
                type="search"
              />
            </label>
            <Button type="submit">Search</Button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={makeShelfHref({
                activeSignal,
                platform: activePlatform,
                queryText,
                sort: gamesSort,
                status: null,
                view: gamesView,
              })}
            >
              <Chip tone={!activeStatus ? "sage" : "neutral"}>All</Chip>
            </Link>
            {statuses.map((status) => (
              <Link
                href={makeShelfHref({
                  activeSignal,
                  platform: activePlatform,
                  queryText,
                  sort: gamesSort,
                  status,
                  view: gamesView,
                })}
                key={status}
              >
                <Chip tone={activeStatus === status ? "sage" : "neutral"}>
                  {getStatusDisplayLabel(status)}
                </Chip>
              </Link>
            ))}
          </div>

          {platforms.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={makeShelfHref({
                  activeSignal,
                  queryText,
                  sort: gamesSort,
                  status: activeStatus,
                  view: gamesView,
                })}
              >
                <Chip tone={!activePlatform ? "blue" : "neutral"}>
                  Any platform
                </Chip>
              </Link>
              {platforms.map((platform) => (
                <Link
                  href={makeShelfHref({
                    activeSignal,
                    platform,
                    queryText,
                    sort: gamesSort,
                    status: activeStatus,
                    view: gamesView,
                  })}
                  key={platform}
                >
                  <Chip tone={activePlatform === platform ? "blue" : "neutral"}>
                    {platform}
                  </Chip>
                </Link>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div className="text-sm text-ink-soft">
              {activeSignal ? (
                <Link
                  className="nav-link text-xs"
                  href={makeShelfHref({
                    activeSignal: null,
                    platform: activePlatform,
                    queryText,
                    sort: gamesSort,
                    status: activeStatus,
                    view: gamesView,
                  })}
                >
                  Clear assistant filter:{" "}
                  {getAssistantSignalDisplayLabel(activeSignal)}
                </Link>
              ) : (
                "Default sort keeps the newest catalog additions close."
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-pill border border-edge bg-surface p-1">
                {[
                  ["added", "Newest"],
                  ["playtime", "Playtime"],
                  ["title", "Title"],
                ].map(([sort, label]) => (
                  <Link
                    href={makeShelfHref({
                      activeSignal,
                      platform: activePlatform,
                      queryText,
                      sort: sort as ProfileGameSort,
                      status: activeStatus,
                      view: gamesView,
                    })}
                    className={cn(
                      "rounded-pill px-3 py-1.5 text-xs font-bold transition-colors",
                      gamesSort === sort
                        ? "bg-ink text-surface"
                        : "text-ink-soft hover:bg-canvas hover:text-ink",
                    )}
                    key={sort}
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <div className="flex gap-1 rounded-pill border border-edge bg-surface p-1">
                {[
                  ["list", List, "List view"],
                  ["grid", LayoutGrid, "Grid view"],
                ].map(([view, Icon, label]) => (
                  <Link
                    href={makeShelfHref({
                      activeSignal,
                      platform: activePlatform,
                      queryText,
                      sort: gamesSort,
                      status: activeStatus,
                      view: view as GamesView,
                    })}
                    className={cn(
                      "grid place-items-center rounded-pill px-3 py-1.5 transition-colors",
                      gamesView === view
                        ? "bg-ink text-surface"
                        : "text-ink-soft hover:bg-canvas hover:text-ink",
                    )}
                    aria-label={label as string}
                    title={label as string}
                    key={view as string}
                  >
                    <Icon className="h-4.5 w-4.5" aria-hidden />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-between gap-4 rounded-card border border-edge bg-sand-soft px-6 py-5 shadow-rest max-md:flex-col max-md:items-start">
        <div>
          <p className="section-label !mb-1">Fresh catalog data</p>
          <p className="text-sm font-semibold leading-snug">
            Playtime, last played, and achievement progress refresh after a
            library sync.
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Last Steam sync:{" "}
            {profile.steamAccount?.lastSyncedAt
              ? formatDate(profile.steamAccount.lastSyncedAt)
              : "not synced yet"}
          </p>
        </div>
        {profile.steamAccount ? (
          <SyncActionForm
            action={syncSteamLibraryAction}
            buttonLabel="Sync Steam library"
            pendingLabel="Syncing Steam..."
            pendingNotice="Steam sync is running. Keep this page open until the library refresh finishes."
          />
        ) : (
          <Button asChild>
            <a href="/api/auth/steam">Connect Steam</a>
          </Button>
        )}
      </section>

      <section className="flex items-center justify-between gap-4 rounded-card border border-edge bg-dusk-lavender-soft px-6 py-5 shadow-rest max-md:flex-col max-md:items-start">
        <div>
          <p className="section-label !mb-1">Credits rolled</p>
          <p className="text-sm font-semibold leading-snug">
            A game is finished when the credits roll, not at 100% achievements.
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Detection looks for each game&apos;s story achievement or trophy on
            Steam and PlayStation and marks the ones you already unlocked.
          </p>
        </div>
        {profile.steamAccount || profile.playStationAccount ? (
          <SyncActionForm
            action={detectFinishedGamesAction}
            buttonLabel="Check credits rolled"
            pendingLabel="Checking..."
            pendingNotice="Checking story achievements. Large libraries can take a few minutes; keep this page open."
          />
        ) : (
          <p className="text-xs font-semibold text-ink-soft">
            Connect Steam or PlayStation to use detection.
          </p>
        )}
      </section>

      <section className={gamesView === "list" ? "panel" : ""}>
        {visibleEntries.length ? (
          <div
            className={cn(
              gamesView === "list"
                ? "grid gap-3"
                : "grid grid-cols-5 gap-4 max-lg:grid-cols-4 max-md:grid-cols-3 max-sm:grid-cols-2",
            )}
          >
            {visibleEntries.map((entry) => (
              <ShelfCard entry={entry} key={entry.id} view={gamesView} />
            ))}
          </div>
        ) : (
          <EmptyState title="Your shelf is ready. Bring some games over.">
            Sync a platform or import a CSV, then the catalog becomes browsable.
          </EmptyState>
        )}
      </section>
    </>
  );
}

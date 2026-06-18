import Link from "next/link";
import { LayoutGrid, List, Search } from "lucide-react";
import { GameCard } from "@/components/game-card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { getAssistantSignalDisplayLabel, getStatusDisplayLabel } from "@/lib/copy";
import { createTranslator, type Locale } from "@/lib/i18n";
import type { ProfileGameSort } from "@/lib/profile-games";
import { cn, formatNumber } from "@/lib/utils";
import { FavoriteButton } from "./favorite-button";
import type { ProfileEntry, ShelfFilters } from "./profile-types";

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
  locale,
  view,
}: {
  entry: ProfileEntry;
  locale: Locale;
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
          locale={locale}
          variant="row"
        />
        <FavoriteButton
          entryId={entry.id}
          gameName={entry.game.name}
          isFavorite={entry.isFavorite}
          locale={locale}
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
        locale={locale}
        variant="shelf"
      />
      <FavoriteButton
        entryId={entry.id}
        gameName={entry.game.name}
        isFavorite={entry.isFavorite}
        locale={locale}
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
  locale,
  visibleEntries,
}: {
  allEntries: ProfileEntry[];
  filters: ShelfFilters;
  gamesSort: ProfileGameSort;
  gamesView: GamesView;
  locale: Locale;
  visibleEntries: ProfileEntry[];
}) {
  const t = createTranslator(locale);
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
          eyebrow={t("profile.shelf.label")}
          title={t("profile.shelf.title")}
          description={t("profile.shelf.description")}
          aside={
            <div className="pill">
              {visibleEntries.length === 1
                ? t("profile.shelf.gameCountOne")
                : t("profile.shelf.gameCount", {
                    count: formatNumber(visibleEntries.length, locale),
                  })}
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
              <span className="sr-only">{t("profile.shelf.searchPlaceholder")}</span>
              <Search
                aria-hidden
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
              />
              <input
                className="min-h-11 w-full rounded-pill border border-edge bg-surface px-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                defaultValue={queryText}
                name="q"
                placeholder={t("profile.shelf.searchPlaceholder")}
                type="search"
              />
            </label>
            <Button type="submit">{t("common.search")}</Button>
          </form>

          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            {activeStatus ? (
              <Chip tone="sage">
                {getStatusDisplayLabel(activeStatus, locale)}
              </Chip>
            ) : null}
            {activePlatform ? <Chip tone="blue">{activePlatform}</Chip> : null}
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
                {t("profile.shelf.clearGuideFilter", {
                  label: getAssistantSignalDisplayLabel(activeSignal, locale),
                })}
              </Link>
            ) : null}
          </div>

          <details className="rounded-inner border border-edge bg-canvas/60 p-4">
            <summary className="cursor-pointer text-sm font-bold">
              {t("profile.shelf.filterSort")}
            </summary>
            <div className="mt-4 grid gap-4">
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
                  <Chip tone={!activeStatus ? "sage" : "neutral"}>
                    {t("common.all")}
                  </Chip>
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
                      {getStatusDisplayLabel(status, locale)}
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
                      {t("common.anyPlatform")}
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

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 rounded-pill border border-edge bg-surface p-1">
                  {[
                    ["added", t("profile.shelf.newest")],
                    ["playtime", t("profile.shelf.playtime")],
                    ["title", t("profile.shelf.titleSort")],
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
                    ["list", List, t("common.listView")],
                    ["grid", LayoutGrid, t("common.gridView")],
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
          </details>
        </div>
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
              <ShelfCard
                entry={entry}
                key={entry.id}
                locale={locale}
                view={gamesView}
              />
            ))}
          </div>
        ) : (
          <EmptyState title={t("profile.shelf.emptyTitle")}>
            {t("profile.shelf.emptyBody")}
          </EmptyState>
        )}
      </section>
    </>
  );
}

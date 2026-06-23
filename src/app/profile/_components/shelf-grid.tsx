import Link from "next/link";
import { LayoutGrid, List, Search } from "lucide-react";
import { GameCard } from "@/components/game-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { catalogRowAccent } from "@/components/ui/status-badge";
import { getAssistantSignalDisplayLabel, getStatusDisplayLabel } from "@/lib/copy";
import { createTranslator, type Locale } from "@/lib/i18n";
import type { ProfileGameSort } from "@/lib/profile-games";
import { cn, formatNumber } from "@/lib/utils";
import { FavoriteButton } from "./favorite-button";
import { markDroppedAction, markFinishedAction } from "../actions";
import {
  getUserPlatformLabel,
  UNKNOWN_PLATFORM_FILTER,
} from "./profile-query";
import type { ProfileEntry, ShelfFilters } from "./profile-types";

type GamesView = "grid" | "list";

function makeShelfHref({
  activeSignal,
  platform,
  queryText,
  sort,
  status,
  view,
  includeDormant,
}: {
  activeSignal: ShelfFilters["activeSignal"];
  includeDormant: boolean;
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

  if (includeDormant) {
    params.set("includeDormant", "1");
  }

  return `/profile?${params.toString()}`;
}

function getPlatformFilterLabel(value: string | null, locale: Locale) {
  if (value === UNKNOWN_PLATFORM_FILTER) {
    return createTranslator(locale)("shelf.unknownPlatform");
  }

  return value;
}

function statusForEntry(entry: ProfileEntry) {
  return entry.finishedAt && entry.status !== "COMPLETED"
    ? "FINISHED"
    : entry.status;
}

function EntryStatusActions({
  entry,
  compact = false,
  locale,
}: {
  entry: ProfileEntry;
  compact?: boolean;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const isDropped = entry.status === "DROPPED";
  const buttonClassName = compact ? "w-full" : "";

  return (
    <>
      <form action={markFinishedAction}>
        <input type="hidden" name="entryId" value={entry.id} />
        <input type="hidden" name="slug" value={entry.game.slug} />
        <Button
          className={buttonClassName}
          disabled={isDropped}
          size="xs"
          title={
            isDropped
              ? t("shelf.restoreBeforeCredits")
              : undefined
          }
          type="submit"
          variant={entry.finishedAt ? "secondary" : "ghost"}
        >
          {entry.finishedAt ? t("shelf.creditsRolled") : t("shelf.rollCredits")}
        </Button>
      </form>
      <form action={markDroppedAction}>
        <input type="hidden" name="entryId" value={entry.id} />
        <input type="hidden" name="slug" value={entry.game.slug} />
        <Button
          className={buttonClassName}
          size="xs"
          type="submit"
          variant={isDropped ? "secondary" : "ghost"}
        >
          {isDropped ? t("shelf.return") : t("shelf.dropped")}
        </Button>
      </form>
    </>
  );
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
  const status = statusForEntry(entry);
  const accent = cn("border-l-4", catalogRowAccent(status));

  if (view === "list") {
    return (
      <div
        className="grid scroll-mt-28 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 target:rounded-card target:ring-2 target:ring-sky max-sm:grid-cols-1"
        id={`entry-${entry.id}`}
      >
        <GameCard
          game={entry.game}
          platformName={entry.platformName}
          playtimeMinutes={entry.playtimeMinutes}
          completionPercent={entry.completionPercent}
          status={status}
          statusVariant="label"
          className={accent}
          locale={locale}
          variant="row"
        />
        <div className="flex flex-wrap items-center justify-end gap-2 max-sm:justify-start">
          <div className="catalog-status-actions flex-wrap items-center justify-end gap-2 max-sm:justify-start">
            <EntryStatusActions entry={entry} locale={locale} />
          </div>
          <FavoriteButton
            entryId={entry.id}
            gameName={entry.game.name}
            isFavorite={entry.isFavorite}
            locale={locale}
          />
        </div>
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
        status={status}
        statusVariant="label"
        className={accent}
        locale={locale}
        variant="shelf"
      />
      <div className="catalog-status-actions flex-wrap gap-2 [&>form]:flex-1">
        <EntryStatusActions compact entry={entry} locale={locale} />
      </div>
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
      allEntries.map(
        (entry) => getUserPlatformLabel(entry) ?? UNKNOWN_PLATFORM_FILTER,
      ),
    ),
  ).slice(0, 10);
  const {
    activePlatform,
    activeSignal,
    activeStatus,
    includeDormant,
    queryText,
  } = filters;

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
            {includeDormant ? (
              <input type="hidden" name="includeDormant" value="1" />
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
            {activePlatform ? (
              <Chip tone="blue">{getPlatformFilterLabel(activePlatform, locale)}</Chip>
            ) : null}
            {includeDormant ? (
              <Chip tone="sand">{t("shelf.includeDormantChip")}</Chip>
            ) : null}
            {activeSignal ? (
              <Link
                className="nav-link text-xs"
                href={makeShelfHref({
                  activeSignal: null,
                  includeDormant,
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
                  includeDormant,
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
                      includeDormant:
                        includeDormant || status === "DROPPED",
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
                      includeDormant,
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
                        includeDormant,
                        platform,
                        queryText,
                        sort: gamesSort,
                        status: activeStatus,
                        view: gamesView,
                      })}
                      key={platform}
                    >
                      <Chip tone={activePlatform === platform ? "blue" : "neutral"}>
                        {getPlatformFilterLabel(platform, locale)}
                      </Chip>
                    </Link>
                  ))}
                </div>
              ) : null}

              <form
                action="/profile"
                className="flex flex-wrap items-center gap-3 rounded-inner border border-edge bg-surface p-3 text-sm"
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
                {queryText ? (
                  <input type="hidden" name="q" value={queryText} />
                ) : null}
                <label className="flex items-center gap-2 font-semibold">
                  <input
                    className="h-4 w-4 accent-ink"
                    defaultChecked={includeDormant}
                    name="includeDormant"
                    type="checkbox"
                    value="1"
                  />
                  {t("shelf.includeDormantLabel")}
                </label>
                <Button size="sm" type="submit" variant="ghost">
                  {t("common.apply")}
                </Button>
              </form>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 rounded-pill border border-edge bg-surface p-1">
                  {[
                    ["status", t("profile.shelf.statusSort")],
                    ["added", t("profile.shelf.newest")],
                    ["playtime", t("profile.shelf.playtime")],
                    ["title", t("profile.shelf.titleSort")],
                  ].map(([sort, label]) => (
                    <Link
                      href={makeShelfHref({
                        activeSignal,
                        includeDormant,
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
                        includeDormant,
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

      <section
        className={cn(
          "catalog-status-section",
          gamesView === "list" ? "panel" : "",
        )}
      >
        {visibleEntries.length ? (
          <>
            <input
              className="catalog-status-mode sr-only"
              id="catalog-status-mode"
              type="checkbox"
            />
            <div className="mb-3 flex justify-end">
              <label
                className={cn(
                  buttonVariants({ size: "sm", variant: "ghost" }),
                  "cursor-pointer",
                )}
                htmlFor="catalog-status-mode"
              >
                {t("shelf.updateStatus")}
              </label>
            </div>
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
          </>
        ) : (
          <EmptyState title={t("profile.shelf.emptyTitle")}>
            {t("profile.shelf.emptyBody")}
          </EmptyState>
        )}
      </section>
    </>
  );
}

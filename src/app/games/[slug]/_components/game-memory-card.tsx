import Image from "next/image";
import Link from "next/link";
import { ExternalProvider } from "@prisma/client";
import { markFinishedAction } from "@/app/profile/actions";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import type { getGameBySlug } from "@/lib/catalog";
import { createTranslator, type Locale } from "@/lib/i18n";
import {
  formatDate,
  formatNumber,
  formatTimeEstimate,
} from "@/lib/utils";

type GameDetail = NonNullable<Awaited<ReturnType<typeof getGameBySlug>>>;
type GameEntry = GameDetail["userEntries"][number];

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object" && "name" in item) {
        return String((item as { name?: unknown }).name ?? "").trim();
      }

      return "";
    })
    .filter(Boolean);
}

function getYear(date: Date | null) {
  return date ? String(date.getFullYear()) : null;
}

function getProviderLabel(provider: ExternalProvider) {
  const labels: Record<ExternalProvider, string> = {
    STEAM: "Steam",
    PLAYSTATION: "PlayStation",
    XBOX: "Xbox",
    IGDB: "IGDB",
    HLTB: "HowLongToBeat",
    METACRITIC: "Metacritic",
  };

  return labels[provider];
}

function getReceptionKey(score: number) {
  if (score >= 85) {
    return "game.reception.beloved";
  }

  if (score >= 75) {
    return "game.reception.strong";
  }

  if (score >= 60) {
    return "game.reception.mixed";
  }

  return "game.reception.quiet";
}

function getPlaytimeSoFar(locale: Locale, entry: GameEntry) {
  const t = createTranslator(locale);

  if (entry.playtimeMinutes === null || entry.playtimeMinutes === undefined) {
    return t("game.noPlaytimeData");
  }

  return t("common.playtimeSoFar", {
    value: formatTimeEstimate(entry.playtimeMinutes, locale),
  });
}

function GameCover({
  game,
  locale,
}: {
  game: GameDetail;
  locale: Locale;
}) {
  const t = createTranslator(locale);

  return (
    <div className="printed-cover relative aspect-[3/4] w-full max-w-[230px] overflow-hidden rounded-card border border-edge bg-sage-soft shadow-lift max-md:mx-auto">
      {game.coverUrl ? (
        <Image
          alt={t("game.coverAlt", { name: game.name })}
          className="object-cover"
          fill
          priority
          sizes="(max-width: 768px) 180px, 230px"
          src={game.coverUrl}
        />
      ) : (
        <div className="grid h-full w-full place-items-center p-5 text-center font-display text-2xl text-ink">
          {game.name}
        </div>
      )}
    </div>
  );
}

function CaseHeader({
  currentEntry,
  game,
  locale,
}: {
  currentEntry: GameEntry | null;
  game: GameDetail;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const platforms = readStringList(game.platforms);
  const genres = readStringList(game.genres);
  const year = getYear(game.releaseDate);

  return (
    <section className="relative overflow-hidden rounded-card border border-edge bg-sky-soft/70 p-8 shadow-soft">
      <div aria-hidden className="absolute inset-x-0 top-0 h-2 bg-glow" />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(135deg,rgba(159,153,209,0.16),rgba(134,186,218,0.12)_52%,rgba(255,227,179,0.1))]"
      />
      <div className="relative grid grid-cols-[240px_minmax(0,1fr)] items-end gap-8 max-md:grid-cols-1">
        <GameCover game={game} locale={locale} />
        <div className="grid gap-5 max-md:text-center">
          <nav
            className="flex flex-wrap items-center gap-2 text-sm text-ink-soft max-md:justify-center"
            aria-label={t("game.breadcrumb")}
          >
            <Link className="nav-link" href="/">
              {t("common.home")}
            </Link>
            <span aria-hidden>/</span>
            <Link className="nav-link" href="/profile?tab=games">
              {t("common.catalog")}
            </Link>
            <span aria-hidden>/</span>
            <span className="max-w-[24ch] truncate text-ink">{game.name}</span>
          </nav>

          <div>
            <h1 className="text-page-title leading-[1.03]">
              {game.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2 max-md:justify-center">
              {year ? <Chip tone="sand">{year}</Chip> : null}
              {platforms.slice(0, 4).map((platform) => (
                <Chip key={platform} tone="blue">
                  {platform}
                </Chip>
              ))}
              {currentEntry ? (
                <StatusBadge
                  locale={locale}
                  status={
                    currentEntry.finishedAt &&
                    currentEntry.status !== "COMPLETED"
                      ? "FINISHED"
                      : currentEntry.status
                  }
                />
              ) : null}
            </div>
          </div>

          {genres.length ? (
            <div className="flex flex-wrap gap-2 max-md:justify-center">
              {genres.slice(0, 6).map((genre) => (
                <Chip key={genre} tone="sage">
                  {genre}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SaveSlot({
  currentEntry,
  game,
  locale,
}: {
  currentEntry: GameEntry | null;
  game: GameDetail;
  locale: Locale;
}) {
  if (!currentEntry) {
    return null;
  }

  const hasStoryTime = Boolean(game.hltbMainStoryMinutes);
  const t = createTranslator(locale);

  return (
    <section className="panel bg-dusk-lavender-soft/70">
      <SectionHeader
        eyebrow={t("game.entryLabel")}
        title={t("game.relationship")}
      />

      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <div className="rounded-inner border border-edge bg-surface p-4">
          <span className="stat-label">{t("game.placeOnShelf")}</span>
          <div className="mt-2">
            <StatusBadge
              locale={locale}
              status={
                currentEntry.finishedAt && currentEntry.status !== "COMPLETED"
                  ? "FINISHED"
                  : currentEntry.status
              }
            />
          </div>
        </div>
        <div className="rounded-inner border border-edge bg-surface p-4">
          <span className="stat-label">{t("game.recordedPlaytime")}</span>
          <strong className="mt-2 block font-display text-2xl font-medium">
            {getPlaytimeSoFar(locale, currentEntry)}
          </strong>
        </div>
        {hasStoryTime ? (
          <div className="rounded-inner border border-edge bg-surface p-4">
            <span className="stat-label">{t("game.usualCredits")}</span>
            <p className="mt-2 text-sm font-semibold leading-relaxed">
              {t("game.creditsAround", {
                value: formatTimeEstimate(game.hltbMainStoryMinutes, locale),
              })}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-inner border border-edge bg-surface p-4">
        <p className="max-w-[58ch] text-sm leading-relaxed text-ink-soft">
          {currentEntry.finishedAt
            ? t("game.creditsRolled", {
                date: formatDate(currentEntry.finishedAt, locale),
              })
            : currentEntry.completionPercent
              ? t("game.achievementSignals")
              : currentEntry.status === "WISHLIST"
                ? t("game.stillCurious")
                : t("game.notMarked")}
        </p>
        <form action={markFinishedAction}>
          <input type="hidden" name="entryId" value={currentEntry.id} />
          <input type="hidden" name="slug" value={game.slug} />
          <Button type="submit" variant="ghost" size="sm">
            {currentEntry.finishedAt
              ? t("game.unmarkCredits")
              : t("game.markCredits")}
          </Button>
        </form>
      </div>
    </section>
  );
}

function GuidePages({
  game,
  locale,
}: {
  game: GameDetail;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const hasCompletionTimes = Boolean(
    game.hltbMainStoryMinutes ||
      game.hltbMainExtraMinutes ||
      game.hltbCompletionistMinutes,
  );
  const hasMetacritic =
    game.metacriticScore !== null && game.metacriticScore !== undefined;

  return (
    <div className="grid gap-7">
      {game.summary ? (
        <section className="panel">
          <SectionHeader
            eyebrow={t("game.catalogNote")}
            title={t("game.whatRemembers")}
          />
          <p className="text-[1.02rem] leading-relaxed text-ink/90">
            {game.summary}
          </p>
        </section>
      ) : null}

      {hasMetacritic ? (
        <section className="panel">
          <SectionHeader
            eyebrow={t("game.reception")}
            title={t("game.noteNotGrade")}
          />
          <p className="font-display text-4xl font-medium leading-none">
            {game.metacriticScore}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            {t("game.criticsSaid", {
              score: game.metacriticScore!,
              label: t(getReceptionKey(game.metacriticScore!)),
            })}
          </p>
        </section>
      ) : null}

      {hasCompletionTimes ? (
        <section className="panel">
          <SectionHeader
            eyebrow={t("game.timeEstimates")}
            title={t("game.playerGuide")}
          />
          <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
            {game.hltbMainStoryMinutes ? (
              <TimeCard
                label={t("game.creditsRoll")}
                value={formatTimeEstimate(game.hltbMainStoryMinutes, locale)}
              />
            ) : null}
            {game.hltbMainExtraMinutes ? (
              <TimeCard
                label={t("game.tookTheirTime")}
                value={formatTimeEstimate(game.hltbMainExtraMinutes, locale)}
              />
            ) : null}
            {game.hltbCompletionistMinutes ? (
              <TimeCard
                label={t("game.sawEverything")}
                value={formatTimeEstimate(game.hltbCompletionistMinutes, locale)}
              />
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TimeCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-inner border border-edge bg-surface p-4 text-center">
      <strong className="block font-display text-2xl font-medium">{value}</strong>
      <span className="stat-label mt-3">{label}</span>
    </div>
  );
}

function ScreenshotStrip({
  game,
  locale,
}: {
  game: GameDetail;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const screenshots = Array.isArray(game.screenshots) ? game.screenshots : [];

  if (!screenshots.length) {
    return null;
  }

  return (
    <section className="panel">
      <SectionHeader
        eyebrow={t("game.photoPrints")}
        title={t("game.fewScenes")}
        aside={
          <span className="text-xs font-semibold text-ink-soft">
            {t("game.opensLightbox")}
          </span>
        }
      />
      <div className="[&_button]:rotate-[-1deg] [&_button:nth-child(even)]:rotate-[1deg]">
        <ScreenshotLightbox
          screenshots={screenshots.slice(0, 6).map(String)}
          gameName={game.name}
        />
      </div>
    </section>
  );
}

function ProviderLinks({
  game,
  locale,
}: {
  game: GameDetail;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const links = game.providerLinks.filter((link) => link.storeUrl);

  if (!links.length) {
    return null;
  }

  return (
    <section className="flex flex-wrap items-center gap-2 border-t border-edge pt-5">
      <span className="text-caption font-bold uppercase text-ink-soft">
        {t("game.whereLives")}
      </span>
      {links.map((link) => (
        <a
          className="rounded-pill border border-edge bg-surface px-3 py-1 text-xs font-bold text-ink-soft shadow-rest transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          href={link.storeUrl ?? "#"}
          key={link.id}
          rel="noreferrer"
          target="_blank"
        >
          {getProviderLabel(link.provider)}
        </a>
      ))}
    </section>
  );
}

function ShelfActivity({
  game,
  locale,
}: {
  game: GameDetail;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  if (!game.userEntries.length) {
    return null;
  }

  return (
    <section className="panel">
      <SectionHeader
        eyebrow={t("game.otherEntries")}
        title={t("game.nearbyShelves")}
        aside={
          <span className="pill">
            {game.userEntries.length === 1
              ? t("game.entryCountOne")
              : t("game.entryCountMany", {
                  count: formatNumber(game.userEntries.length, locale),
                })}
          </span>
        }
      />
      <div className="grid gap-3">
        {game.userEntries.slice(0, 6).map((entry) => (
          <div
            className="flex items-center gap-3 rounded-inner border border-edge bg-surface p-3"
            key={entry.id}
          >
            <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-sand-soft font-display text-xs">
              {(entry.user.displayName ?? "P").slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {entry.user.displayName ?? t("common.player")}
              </p>
              <p className="text-xs text-ink-soft">
                {getPlaytimeSoFar(locale, entry)}
              </p>
            </div>
            <StatusBadge
              locale={locale}
              status={
                entry.finishedAt && entry.status !== "COMPLETED"
                  ? "FINISHED"
                  : entry.status
              }
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export function GameMemoryCard({
  game,
  locale,
  sessionUserId,
}: {
  game: GameDetail;
  locale: Locale;
  sessionUserId: string | null;
}) {
  const currentEntry =
    game.userEntries.find((entry) => entry.userId === sessionUserId) ?? null;

  return (
    <main
      id="main-content"
      className="mx-auto grid w-full max-w-[1100px] gap-7 pb-12"
    >
      <CaseHeader currentEntry={currentEntry} game={game} locale={locale} />

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-7 max-lg:grid-cols-1">
        <div className="grid content-start gap-7">
          <SaveSlot currentEntry={currentEntry} game={game} locale={locale} />
          <GuidePages game={game} locale={locale} />
          <ScreenshotStrip game={game} locale={locale} />
        </div>

        <aside className="grid content-start gap-6">
          <ShelfActivity game={game} locale={locale} />
          <ProviderLinks game={game} locale={locale} />
          <Button asChild variant="ghost" className="justify-center text-sm">
            <Link href="/profile?tab=games">
              {createTranslator(locale)("game.backToCatalog")}
            </Link>
          </Button>
        </aside>
      </div>
    </main>
  );
}

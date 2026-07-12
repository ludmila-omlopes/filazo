import Image from "next/image";
import Link from "next/link";
import { ExternalProvider } from "@prisma/client";
import { BookOpen, ChevronRight } from "lucide-react";
import {
  markDroppedAction,
  markFinishedAction,
  resolveSyncedPlaytimeAction,
  saveManualStartedAtAction,
  saveManualPlaytimeAction,
  savePlayingNextDateAction,
} from "@/app/profile/actions";
import { PhysicalMediaButton } from "@/app/profile/_components/physical-media-button";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import type { getGameBySlug } from "@/lib/catalog";
import { createTranslator, type Locale } from "@/lib/i18n";
import { estimatePlayStartDate, weeklyHoursFromOnboarding } from "@/lib/play-planning";
import {
  formatDate,
  formatNumber,
  formatTimeEstimate,
} from "@/lib/utils";

type GameDetail = NonNullable<Awaited<ReturnType<typeof getGameBySlug>>>;
type GameEntry = GameDetail["userEntries"][number];

function chooseDisplayedEntry(entries: GameEntry[]) {
  return entries.find((entry) => entry.currentPlayingSlot !== null) ??
    entries.find((entry) => entry.playtimeSource === "manual") ??
    [...entries].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0] ??
    null;
}

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
    IGDB: "Metadata",
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
              {currentEntry?.isPhysicalCopy ? (
                <Chip tone="sage">{t("physicalMedia.label")}</Chip>
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
  const weeklyHours = weeklyHoursFromOnboarding(currentEntry.user.onboardingAnswers);
  const inferredStartedAt = estimatePlayStartDate(
    currentEntry.playtimeMinutes ?? 0,
    weeklyHours * 60 / 7,
  );
  const isPlayingNext = currentEntry.status === "PLAYING_NEXT";

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
          {currentEntry.pendingPlaytimeMinutes !== null ? (
            <div className="mt-4 rounded-inner border border-sand-deep/40 bg-sand-soft p-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">{t("game.playtimeSync.kicker")}</p>
              <p className="mt-1 text-sm leading-relaxed">
                {t("game.playtimeSync.body", {
                  current: formatTimeEstimate(currentEntry.playtimeMinutes ?? 0, locale),
                  synced: formatTimeEstimate(currentEntry.pendingPlaytimeMinutes, locale),
                })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={resolveSyncedPlaytimeAction}>
                  <input name="decision" type="hidden" value="accept" />
                  <input name="entryId" type="hidden" value={currentEntry.id} />
                  <input name="slug" type="hidden" value={game.slug} />
                  <Button size="sm" type="submit">{t("game.playtimeSync.accept")}</Button>
                </form>
                <form action={resolveSyncedPlaytimeAction}>
                  <input name="decision" type="hidden" value="keep" />
                  <input name="entryId" type="hidden" value={currentEntry.id} />
                  <input name="slug" type="hidden" value={game.slug} />
                  <Button size="sm" type="submit" variant="ghost">{t("game.playtimeSync.keep")}</Button>
                </form>
              </div>
            </div>
          ) : null}
        </div>
        <div className="rounded-inner border border-edge bg-surface p-4">
          <span className="stat-label">{t("game.ownershipFormat")}</span>
          <strong className="mt-2 block font-display text-2xl font-medium">
            {currentEntry.isPhysicalCopy
              ? t("physicalMedia.label")
              : t("game.digitalOrUnspecified")}
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

      <form action={saveManualPlaytimeAction} className="mt-5 rounded-inner border border-edge bg-surface p-4">
        <input name="entryId" type="hidden" value={currentEntry.id} />
        <input name="slug" type="hidden" value={game.slug} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="mr-auto max-w-[42ch]">
            <h3 className="font-semibold">{t("game.manualPlaytime.title")}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{t("game.manualPlaytime.body")}</p>
          </div>
          <label className="grid gap-1 text-xs font-bold text-ink-soft">
            {t("game.manualPlaytime.hours")}
            <input className="h-10 w-24 rounded-inner border border-edge bg-canvas px-3 text-ink" defaultValue={Math.floor((currentEntry.playtimeMinutes ?? 0) / 60)} inputMode="numeric" min="0" name="hours" required type="number" />
          </label>
          <label className="grid gap-1 text-xs font-bold text-ink-soft">
            {t("game.manualPlaytime.minutes")}
            <input className="h-10 w-20 rounded-inner border border-edge bg-canvas px-3 text-ink" defaultValue={(currentEntry.playtimeMinutes ?? 0) % 60} inputMode="numeric" max="59" min="0" name="minutes" required type="number" />
          </label>
          <Button size="sm" type="submit">{t("game.manualPlaytime.save")}</Button>
        </div>
      </form>

      <form action={isPlayingNext ? savePlayingNextDateAction : saveManualStartedAtAction} className="mt-3 rounded-inner border border-edge bg-surface p-4">
        <input name="entryId" type="hidden" value={currentEntry.id} />
        <input name="slug" type="hidden" value={game.slug} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="mr-auto max-w-[48ch]">
            <h3 className="font-semibold">{t(isPlayingNext ? "game.plannedStartDate.title" : "game.manualStartedAt.title")}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              {isPlayingNext
                ? t("game.plannedStartDate.body")
                : currentEntry.manualStartedAt
                ? t("game.manualStartedAt.manualBody")
                : t("game.manualStartedAt.estimatedBody", { date: formatDate(inferredStartedAt, locale) })}
            </p>
          </div>
          <label className="grid gap-1 text-xs font-bold text-ink-soft">
            {t(isPlayingNext ? "game.plannedStartDate.label" : "game.manualStartedAt.label")}
            <input
              className="h-10 rounded-inner border border-edge bg-canvas px-3 text-ink"
              defaultValue={isPlayingNext
                ? currentEntry.plannedStartDate?.toISOString().slice(0, 10) ?? ""
                : (currentEntry.manualStartedAt ?? inferredStartedAt).toISOString().slice(0, 10)}
              max={isPlayingNext ? undefined : new Date().toISOString().slice(0, 10)}
              name={isPlayingNext ? "plannedStartDate" : "manualStartedAt"}
              required
              type="date"
            />
          </label>
          <Button size="sm" type="submit">{t(isPlayingNext ? "game.plannedStartDate.save" : "game.manualStartedAt.save")}</Button>
        </div>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-inner border border-edge bg-surface p-4">
        <p className="max-w-[58ch] text-sm leading-relaxed text-ink-soft">
          {currentEntry.status === "DROPPED"
            ? currentEntry.abandonedAt
              ? t("game.releasedOn", {
                  date: formatDate(currentEntry.abandonedAt, locale),
                })
              : t("game.released")
            : currentEntry.finishedAt
              ? t("game.creditsRolled", {
                  date: formatDate(currentEntry.finishedAt, locale),
                })
            : currentEntry.completionPercent
              ? t("game.achievementSignals")
              : currentEntry.status === "WISHLIST"
                ? t("game.stillCurious")
                : t("game.notMarked")}
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={markFinishedAction}>
            <input type="hidden" name="entryId" value={currentEntry.id} />
            <input type="hidden" name="slug" value={game.slug} />
            <Button
              disabled={currentEntry.status === "DROPPED"}
              type="submit"
              variant="ghost"
              size="sm"
            >
              {currentEntry.finishedAt
                ? t("game.unmarkCredits")
                : t("game.markCredits")}
            </Button>
          </form>
          <form action={markDroppedAction}>
            <input type="hidden" name="entryId" value={currentEntry.id} />
            <input type="hidden" name="slug" value={game.slug} />
            <Button type="submit" variant="ghost" size="sm">
              {currentEntry.status === "DROPPED"
                ? t("game.returnToShelf")
                : t("game.markDropped")}
            </Button>
          </form>
          <PhysicalMediaButton
            entryId={currentEntry.id}
            gameName={game.name}
            isPhysicalCopy={currentEntry.isPhysicalCopy}
            locale={locale}
            fullWidth
          />
        </div>
      </div>
    </section>
  );
}

function UserReviews({
  game,
  sessionUserId,
}: {
  game: GameDetail;
  sessionUserId: string | null;
}) {
  const reviews = sessionUserId
    ? game.userReviews.filter((review) => review.userId === sessionUserId)
    : [];

  if (!reviews.length) {
    return null;
  }

  return (
    <section className="panel bg-sage-soft/60">
      <SectionHeader
        eyebrow="Player review"
        title="What you said elsewhere"
      />
      <div className="grid gap-3">
        {reviews.slice(0, 3).map((review) => (
          <article
            className="rounded-inner border border-edge bg-surface p-4"
            key={review.id}
          >
            <div className="flex flex-wrap items-center gap-2">
              {review.provider ? (
                <Chip tone="blue">{getProviderLabel(review.provider)}</Chip>
              ) : null}
              {review.recommended !== null ? (
                <Chip tone={review.recommended ? "sage" : "sand"}>
                  {review.recommended ? "Recommended" : "Not recommended"}
                </Chip>
              ) : null}
              {review.reviewedAt ? (
                <span className="text-xs font-semibold text-ink-soft">
                  {formatDate(review.reviewedAt)}
                </span>
              ) : null}
            </div>
            {review.body ? (
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/90">
                {review.body}
              </p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                The provider exposed the review record, but not the review text.
              </p>
            )}
            {review.sourceUrl ? (
              <a
                className="nav-link mt-3 inline-flex text-xs"
                href={review.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open source review
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function JournalPanel({
  currentEntry,
  game,
  sessionUserId,
}: {
  currentEntry: GameEntry | null;
  game: GameDetail;
  sessionUserId: string | null;
}) {
  const journalEntries = sessionUserId
    ? game.journalEntries.filter((entry) => entry.userId === sessionUserId)
    : [];
  const journalHref = currentEntry
    ? `/profile?tab=journal&entryId=${currentEntry.id}`
    : "/profile?tab=games";

  return (
    <section className="panel bg-sky-soft/55">
      <SectionHeader
        eyebrow="Diary"
        title="Open Your Play Diary"
        description="Voice notes, screenshots, and longer pages are waiting in the profile journal."
      />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-edge bg-surface p-5 shadow-rest">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-14 w-14 flex-none place-items-center rounded-inner border border-edge bg-sand-soft text-ink">
            <BookOpen className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="section-label !mb-1">
              {journalEntries.length
                ? `${journalEntries.length} saved page${
                    journalEntries.length === 1 ? "" : "s"
                  }`
                : "No diary pages yet"}
            </p>
            <p className="text-pretty text-sm font-semibold text-ink-soft">
              {currentEntry
                ? "Open the profile journal to record a quick voice note or browse past pages."
                : "Add this game to your shelf before writing diary pages for it."}
            </p>
          </div>
        </div>
        <Button asChild size="lg" variant={currentEntry ? "default" : "ghost"}>
          <Link href={journalHref}>
            {currentEntry ? "Open Journal" : "Open Catalog"}
            <ChevronRight />
          </Link>
        </Button>
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

function ReceptionPanel({
  game,
  locale,
}: {
  game: GameDetail;
  locale: Locale;
}) {
  if (game.metacriticScore === null || game.metacriticScore === undefined) {
    return null;
  }

  const t = createTranslator(locale);

  return (
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
          score: game.metacriticScore,
          label: t(getReceptionKey(game.metacriticScore)),
        })}
      </p>
    </section>
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
  const entriesByUser = new Map<string, GameEntry[]>();
  for (const entry of game.userEntries) {
    const userEntries = entriesByUser.get(entry.userId) ?? [];
    userEntries.push(entry);
    entriesByUser.set(entry.userId, userEntries);
  }
  const displayedEntries = [...entriesByUser.values()]
    .map(chooseDisplayedEntry)
    .filter((entry): entry is GameEntry => entry !== null);

  if (!displayedEntries.length) {
    return null;
  }

  return (
    <section className="panel">
      <SectionHeader
        eyebrow={t("game.otherEntries")}
        title={t("game.nearbyShelves")}
        aside={
          <span className="pill">
            {displayedEntries.length === 1
              ? t("game.entryCountOne")
              : t("game.entryCountMany", {
                  count: formatNumber(displayedEntries.length, locale),
                })}
          </span>
        }
      />
      <div className="grid gap-3">
        {displayedEntries.slice(0, 6).map((entry) => (
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
    chooseDisplayedEntry(
      game.userEntries.filter((entry) => entry.userId === sessionUserId),
    );

  return (
    <main
      id="main-content"
      className="mx-auto grid w-full max-w-[1100px] gap-7 pb-12"
    >
      <CaseHeader currentEntry={currentEntry} game={game} locale={locale} />

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-7 max-lg:grid-cols-1">
        <div className="grid content-start gap-7">
          <SaveSlot currentEntry={currentEntry} game={game} locale={locale} />
          <JournalPanel
            currentEntry={currentEntry}
            game={game}
            sessionUserId={sessionUserId}
          />
          <UserReviews game={game} sessionUserId={sessionUserId} />
          <GuidePages game={game} locale={locale} />
          <ScreenshotStrip game={game} locale={locale} />
        </div>

        <aside className="grid content-start gap-6">
          <ReceptionPanel game={game} locale={locale} />
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

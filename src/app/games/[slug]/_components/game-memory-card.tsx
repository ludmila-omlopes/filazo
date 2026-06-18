import Image from "next/image";
import Link from "next/link";
import { ExternalProvider } from "@prisma/client";
import { BookOpen, ChevronRight } from "lucide-react";
import {
  markDroppedAction,
  markFinishedAction,
} from "@/app/profile/actions";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import type { getGameBySlug } from "@/lib/catalog";
import {
  formatDate,
  formatNumber,
  formatPlaytime,
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
    IGDB: "Metadata",
    HLTB: "HowLongToBeat",
    METACRITIC: "Metacritic",
  };

  return labels[provider];
}

function getReceptionLabel(score: number) {
  if (score >= 85) {
    return "beloved";
  }

  if (score >= 75) {
    return "strong reception";
  }

  if (score >= 60) {
    return "mixed but noticed";
  }

  return "a quieter reception";
}

function getPlaytimeSoFar(entry: GameEntry) {
  if (entry.playtimeMinutes === null || entry.playtimeMinutes === undefined) {
    return "No playtime data";
  }

  return formatPlaytime(entry.playtimeMinutes).replace(" played", " so far");
}

function GameCover({ game }: { game: GameDetail }) {
  return (
    <div className="printed-cover relative aspect-[3/4] w-full max-w-[230px] overflow-hidden rounded-card border border-edge bg-sage-soft shadow-lift max-md:mx-auto">
      {game.coverUrl ? (
        <Image
          alt={`Cover art for ${game.name}`}
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
}: {
  currentEntry: GameEntry | null;
  game: GameDetail;
}) {
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
        <GameCover game={game} />
        <div className="grid gap-5 max-md:text-center">
          <nav
            className="flex flex-wrap items-center gap-2 text-sm text-ink-soft max-md:justify-center"
            aria-label="Breadcrumb"
          >
            <Link className="nav-link" href="/">
              Home
            </Link>
            <span aria-hidden>/</span>
            <Link className="nav-link" href="/profile?tab=games">
              Catalog
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
}: {
  currentEntry: GameEntry | null;
  game: GameDetail;
}) {
  if (!currentEntry) {
    return null;
  }

  const hasStoryTime = Boolean(game.hltbMainStoryMinutes);

  return (
    <section className="panel bg-dusk-lavender-soft/70">
      <SectionHeader
        eyebrow="Catalog entry"
        title="Your relationship with this game"
      />

      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <div className="rounded-inner border border-edge bg-surface p-4">
          <span className="stat-label">Place on shelf</span>
          <div className="mt-2">
            <StatusBadge
              status={
                currentEntry.finishedAt && currentEntry.status !== "COMPLETED"
                  ? "FINISHED"
                  : currentEntry.status
              }
            />
          </div>
        </div>
        <div className="rounded-inner border border-edge bg-surface p-4">
          <span className="stat-label">Recorded playtime</span>
          <strong className="mt-2 block font-display text-2xl font-medium">
            {getPlaytimeSoFar(currentEntry)}
          </strong>
        </div>
        {hasStoryTime ? (
          <div className="rounded-inner border border-edge bg-surface p-4">
            <span className="stat-label">Usual credits</span>
            <p className="mt-2 text-sm font-semibold leading-relaxed">
              Most players see credits around{" "}
              {formatTimeEstimate(game.hltbMainStoryMinutes)}.
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-inner border border-edge bg-surface p-4">
        <p className="max-w-[58ch] text-sm leading-relaxed text-ink-soft">
          {currentEntry.status === "DROPPED"
            ? currentEntry.abandonedAt
              ? `Released from the active shelf ${formatDate(currentEntry.abandonedAt)}.`
              : "Released from the active shelf."
            : currentEntry.finishedAt
            ? `Credits rolled ${formatDate(currentEntry.finishedAt)}. This is separate from achievement collecting.`
            : currentEntry.completionPercent
              ? "Some achievement signals are on the record, but credits are not marked yet."
              : currentEntry.status === "WISHLIST"
                ? "Still curious. Keep it close until the moment feels right."
              : "The story has not been marked as credits rolled yet."}
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
                ? "Unmark credits rolled"
                : "Mark credits rolled"}
            </Button>
          </form>
          <form action={markDroppedAction}>
            <input type="hidden" name="entryId" value={currentEntry.id} />
            <input type="hidden" name="slug" value={game.slug} />
            <Button type="submit" variant="ghost" size="sm">
              {currentEntry.status === "DROPPED"
                ? "Return to shelf"
                : "Mark dropped"}
            </Button>
          </form>
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

function GuidePages({ game }: { game: GameDetail }) {
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
          <SectionHeader eyebrow="Catalog note" title="What this one remembers" />
          <p className="text-[1.02rem] leading-relaxed text-ink/90">
            {game.summary}
          </p>
        </section>
      ) : null}

      {hasMetacritic ? (
        <section className="panel">
          <SectionHeader eyebrow="Reception" title="A note, not a grade" />
          <p className="font-display text-4xl font-medium leading-none">
            {game.metacriticScore}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Critics said: {game.metacriticScore} -{" "}
            {getReceptionLabel(game.metacriticScore!)}.
          </p>
        </section>
      ) : null}

      {hasCompletionTimes ? (
        <section className="panel">
          <SectionHeader
            eyebrow="Time estimates"
            title="Player guide notes"
          />
          <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
            {game.hltbMainStoryMinutes ? (
              <TimeCard
                label="credits roll"
                value={formatTimeEstimate(game.hltbMainStoryMinutes)}
              />
            ) : null}
            {game.hltbMainExtraMinutes ? (
              <TimeCard
                label="took their time"
                value={formatTimeEstimate(game.hltbMainExtraMinutes)}
              />
            ) : null}
            {game.hltbCompletionistMinutes ? (
              <TimeCard
                label="saw everything"
                value={formatTimeEstimate(game.hltbCompletionistMinutes)}
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

function ScreenshotStrip({ game }: { game: GameDetail }) {
  const screenshots = Array.isArray(game.screenshots) ? game.screenshots : [];

  if (!screenshots.length) {
    return null;
  }

  return (
    <section className="panel">
      <SectionHeader
        eyebrow="Photo prints"
        title="A few scenes from the guide"
        aside={
          <span className="text-xs font-semibold text-ink-soft">
            Opens in a lightbox
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

function ProviderLinks({ game }: { game: GameDetail }) {
  const links = game.providerLinks.filter((link) => link.storeUrl);

  if (!links.length) {
    return null;
  }

  return (
    <section className="flex flex-wrap items-center gap-2 border-t border-edge pt-5">
      <span className="text-caption font-bold uppercase text-ink-soft">
        Where it lives
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

function ShelfActivity({ game }: { game: GameDetail }) {
  if (!game.userEntries.length) {
    return null;
  }

  return (
    <section className="panel">
      <SectionHeader
        eyebrow="Other entries"
        title="How it sits on nearby shelves"
        aside={
          <span className="pill">
            {formatNumber(game.userEntries.length)}{" "}
            {game.userEntries.length === 1 ? "entry" : "entries"}
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
                {entry.user.displayName ?? "Player"}
              </p>
              <p className="text-xs text-ink-soft">
                {getPlaytimeSoFar(entry)}
              </p>
            </div>
            <StatusBadge
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
  sessionUserId,
}: {
  game: GameDetail;
  sessionUserId: string | null;
}) {
  const currentEntry =
    game.userEntries.find((entry) => entry.userId === sessionUserId) ?? null;

  return (
    <main
      id="main-content"
      className="mx-auto grid w-full max-w-[1100px] gap-7 pb-12"
    >
      <CaseHeader currentEntry={currentEntry} game={game} />

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-7 max-lg:grid-cols-1">
        <div className="grid content-start gap-7">
          <SaveSlot currentEntry={currentEntry} game={game} />
          <JournalPanel
            currentEntry={currentEntry}
            game={game}
            sessionUserId={sessionUserId}
          />
          <UserReviews game={game} sessionUserId={sessionUserId} />
          <GuidePages game={game} />
          <ScreenshotStrip game={game} />
        </div>

        <aside className="grid content-start gap-6">
          <ShelfActivity game={game} />
          <ProviderLinks game={game} />
          <Button asChild variant="ghost" className="justify-center text-sm">
            <Link href="/profile?tab=games">Back to catalog</Link>
          </Button>
        </aside>
      </div>
    </main>
  );
}

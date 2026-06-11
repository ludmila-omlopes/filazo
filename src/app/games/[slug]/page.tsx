import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalProvider } from "@prisma/client";
import { getGameBySlug } from "@/lib/catalog";
import { getSessionUserId } from "@/lib/session";
import { markFinishedAction } from "@/app/profile/actions";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  cn,
  formatDate,
  formatNumber,
  formatPlaytime,
  formatRemainingTime,
  formatTimeEstimate,
} from "@/lib/utils";
import { estimateRemainingTime } from "@/lib/time-estimates";

export async function generateMetadata({
  params,
}: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);

  if (!game) {
    return {
      title: "Game not found | filazo",
    };
  }

  return {
    title: `${game.name} | filazo`,
    description:
      game.summary ??
      `filazo catalog page for ${game.name}, enriched with IGDB metadata.`,
  };
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-edge pb-3 last:border-b-0 last:pb-0">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="text-right text-sm font-semibold">{children}</dd>
    </div>
  );
}

function ScoreBadge({ value }: { value: number }) {
  return (
    <div
      className={cn(
        "grid h-10 w-10 place-items-center rounded-[12px] font-display text-sm font-semibold",
        value >= 75
          ? "bg-sage/80 text-ink"
          : value >= 50
            ? "bg-sand/80 text-ink"
            : "bg-clay/70 text-surface",
      )}
    >
      {value}
    </div>
  );
}

export default async function GamePage({
  params,
}: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  const [game, sessionUserId] = await Promise.all([
    getGameBySlug(slug),
    getSessionUserId(),
  ]);

  if (!game) {
    notFound();
  }

  const owners = game.userEntries.filter((entry) => entry.status === "OWNED");
  const wishlisters = game.userEntries.filter(
    (entry) => entry.status === "WISHLIST",
  );
  const platforms = Array.isArray(game.platforms) ? game.platforms : [];
  const genres = Array.isArray(game.genres) ? game.genres : [];
  const screenshots = Array.isArray(game.screenshots) ? game.screenshots : [];
  const websites = Array.isArray(game.websites) ? game.websites : [];
  const hasRating =
    game.aggregatedRating !== null && game.aggregatedRating !== undefined;
  const ratingValue = hasRating ? Math.round(game.aggregatedRating!) : 0;
  const hltbLink = game.providerLinks.find(
    (link) => link.provider === ExternalProvider.HLTB,
  );
  const metacriticLink = game.providerLinks.find(
    (link) => link.provider === ExternalProvider.METACRITIC,
  );
  const hasMetacritic =
    game.metacriticScore !== null && game.metacriticScore !== undefined;
  const hasCompletionTimes = Boolean(
    game.hltbMainStoryMinutes ||
      game.hltbMainExtraMinutes ||
      game.hltbCompletionistMinutes,
  );

  return (
    <main id="main-content" className="mx-auto grid w-full max-w-[1100px] gap-7 pb-12">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-card border border-edge shadow-soft">
        {/* Background hero image (blurred) */}
        {game.heroUrl || game.coverUrl ? (
          <div className="absolute inset-0">
            <img
              alt=""
              src={game.heroUrl ?? game.coverUrl ?? ""}
              className="h-full w-full scale-105 object-cover blur-sm"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/70 to-ink/35" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-sage/60 to-sky/50" />
        )}

        {/* Hero content */}
        <div className="relative z-10 grid grid-cols-[200px_1fr] items-end gap-8 p-9 max-md:grid-cols-1 max-md:gap-5">
          {/* Cover art */}
          <div className="aspect-[3/4] w-[200px] overflow-hidden rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.35)] max-md:mx-auto max-md:w-[140px]">
            {game.coverUrl ? (
              <img
                alt={`Cover art for ${game.name}`}
                src={game.coverUrl}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-sage-soft p-4 text-center font-display text-xl text-ink">
                {game.name}
              </div>
            )}
          </div>

          {/* Title + quick info */}
          <div className="max-md:text-center">
            {/* Breadcrumb */}
            <nav className="mb-3 flex items-center gap-2 text-sm text-surface/55 max-md:justify-center" aria-label="Breadcrumb">
              <Link href="/" className="transition-colors hover:text-surface/85">
                Home
              </Link>
              <span>/</span>
              <Link href="/profile?tab=games" className="transition-colors hover:text-surface/85">
                Games
              </Link>
              <span>/</span>
              <span className="max-w-[20ch] truncate text-surface/85">
                {game.name}
              </span>
            </nav>

            <h1 className="text-[clamp(1.9rem,4.5vw,3rem)] leading-[1.08] text-surface">
              {game.name}
            </h1>

            {/* Tags row */}
            <div className="mt-4 flex flex-wrap items-center gap-2 max-md:justify-center">
              {genres.slice(0, 3).map((genre) => (
                <span
                  key={String(genre)}
                  className="rounded-full border border-surface/15 bg-surface/15 px-3 py-1 text-label font-semibold text-surface/90 backdrop-blur-sm"
                >
                  {String(genre)}
                </span>
              ))}
              {platforms.slice(0, 3).map((platform) => (
                <span
                  key={String(platform)}
                  className="rounded-full border border-surface/10 bg-sky/25 px-3 py-1 text-label font-semibold text-surface/90 backdrop-blur-sm"
                >
                  {String(platform)}
                </span>
              ))}
            </div>

            {/* Quick stats inline */}
            <div className="mt-5 flex items-center gap-5 max-md:justify-center max-md:flex-wrap">
              {hasRating ? (
                <div className="flex items-center gap-2">
                  <ScoreBadge value={ratingValue} />
                  <div className="text-xs leading-tight text-surface/60">
                    <span className="block font-semibold text-surface/85">
                      IGDB
                    </span>
                    {game.totalRatingCount
                      ? `${formatNumber(game.totalRatingCount)} ratings`
                      : "rating"}
                  </div>
                </div>
              ) : null}
              {hasMetacritic ? (
                <div className="flex items-center gap-2">
                  <ScoreBadge value={game.metacriticScore!} />
                  <div className="text-xs leading-tight text-surface/60">
                    <span className="block font-semibold text-surface/85">
                      Metacritic
                    </span>
                    metascore
                  </div>
                </div>
              ) : null}
              <div className="text-xs leading-tight text-surface/60">
                <span className="block font-semibold text-surface/85">
                  Released
                </span>
                {formatDate(game.releaseDate)}
              </div>
              <div className="text-xs leading-tight text-surface/60">
                <span className="block font-semibold text-surface/85">
                  Owners
                </span>
                {formatNumber(owners.length)} in catalog
              </div>
              {game.hltbMainStoryMinutes ? (
                <div className="text-xs leading-tight text-surface/60">
                  <span className="block font-semibold text-surface/85">
                    Main story
                  </span>
                  {formatTimeEstimate(game.hltbMainStoryMinutes)}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ── Body Grid: Sidebar + Main ── */}
      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-7 max-lg:grid-cols-1">
        {/* ── Main Column ── */}
        <div className="grid content-start gap-7">
          {/* About */}
          {game.summary ? (
            <section className="panel">
              <span className="section-label">About</span>
              <p className="text-[1.02rem] leading-relaxed text-ink/90">
                {game.summary}
              </p>
            </section>
          ) : null}

          {/* Screenshots */}
          {screenshots.length ? (
            <section className="panel">
              <div className="mb-5 flex items-center justify-between gap-3.5">
                <span className="section-label !mb-0">Screenshots</span>
                <span className="text-xs text-ink-soft">
                  {screenshots.length} {screenshots.length === 1 ? "image" : "images"} &middot; click to enlarge
                </span>
              </div>
              <ScreenshotLightbox
                screenshots={screenshots.slice(0, 6).map(String)}
                gameName={game.name}
              />
            </section>
          ) : null}

          {/* Ownership / Activity */}
          <section className="panel">
            <div className="mb-5 flex items-center justify-between gap-3.5">
              <span className="section-label !mb-0">Library activity</span>
              <span className="text-xs text-ink-soft">
                {game.userEntries.length} {game.userEntries.length === 1 ? "player" : "players"}
              </span>
            </div>

            {game.userEntries.length ? (
              <div className="grid gap-2.5">
                {game.userEntries.map((entry) => {
                  const remainingTime = estimateRemainingTime({
                    ...entry,
                    game,
                  });

                  return (
                    <div
                      className="flex items-center gap-4 rounded-inner border border-edge bg-surface p-3.5 transition-colors hover:bg-canvas"
                      key={entry.id}
                    >
                      <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-sand-soft font-display text-xs">
                        {(entry.user.displayName ?? "C").slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {entry.user.displayName ?? "Player"}
                        </span>
                        <span className="text-xs text-ink-soft">
                          {formatPlaytime(
                            entry.playtimeMinutes,
                            entry.completionPercent,
                          )}
                        </span>
                        {remainingTime ? (
                          <span
                            className="ml-2 text-xs font-semibold text-ink-soft"
                            title={`Based on HLTB ${remainingTime.targetLabel}`}
                          >
                            {formatRemainingTime(remainingTime.remainingMinutes)}
                          </span>
                        ) : null}
                        {entry.finishedAt ? (
                          <span
                            className="ml-2 text-xs text-ink-soft"
                            title={
                              entry.finishedSource === "story_achievement"
                                ? "Detected from the story achievement"
                                : entry.finishedSource === "import"
                                  ? "Marked finished in an import"
                                  : "Marked finished manually"
                            }
                          >
                            Credits rolled {formatDate(entry.finishedAt)}
                          </span>
                        ) : null}
                      </div>
                      {entry.userId === sessionUserId ? (
                        <form action={markFinishedAction}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <input type="hidden" name="slug" value={game.slug} />
                          <button
                            className="cursor-pointer rounded-pill border border-edge bg-surface px-3 py-1 text-xs font-bold transition-colors hover:bg-canvas"
                            type="submit"
                            title="Credits rolled is separate from achievement progress."
                          >
                            {entry.finishedAt ? "Unmark credits rolled" : "Mark credits rolled"}
                          </button>
                        </form>
                      ) : null}
                      <StatusBadge
                        status={
                          entry.finishedAt && entry.status !== "COMPLETED"
                            ? "FINISHED"
                            : entry.status
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-inner border border-dashed border-edge bg-surface/60 p-6 text-center">
                <p className="text-sm font-semibold">No shelf activity yet.</p>
                <p className="mt-1 text-xs text-ink-soft">
                  This catalog record is ready whenever someone adds it.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* ── Sidebar ── */}
        <aside className="grid content-start gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {/* Game Details card */}
          <div className="panel !p-5">
            <span className="section-label">Details</span>
            <dl className="grid gap-3 text-sm">
              <DetailRow label="Release">{formatDate(game.releaseDate)}</DetailRow>
              <DetailRow label="Rating">
                {hasRating ? `${ratingValue} / 100` : "No rating"}
              </DetailRow>
              <DetailRow label="Metacritic">
                {hasMetacritic ? `${game.metacriticScore} / 100` : "No score"}
              </DetailRow>
              <DetailRow label="Platforms">
                <span className="block max-w-[18ch]">
                  {platforms.length
                    ? platforms.map(String).join(", ")
                    : "Unknown"}
                </span>
              </DetailRow>
              <DetailRow label="Genres">
                <span className="block max-w-[18ch]">
                  {genres.length ? genres.map(String).join(", ") : "Unknown"}
                </span>
              </DetailRow>
              <DetailRow label="Source">
                {game.metadataSource ?? "Local catalog"}
              </DetailRow>
              <DetailRow label="Providers">
                {formatNumber(game.providerLinks.length)} linked
              </DetailRow>
            </dl>
          </div>

          <div className="panel !p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="section-label !mb-0">HowLongToBeat</span>
              {hltbLink?.storeUrl ? (
                <a
                  href={hltbLink.storeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-ink-soft transition-colors hover:text-ink"
                >
                  View
                </a>
              ) : null}
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <DetailRow label="Main story">
                <span className="font-display text-lg leading-none">
                  {formatTimeEstimate(game.hltbMainStoryMinutes)}
                </span>
              </DetailRow>
              <DetailRow label="Main + extras">
                <span className="font-display text-lg leading-none">
                  {formatTimeEstimate(game.hltbMainExtraMinutes)}
                </span>
              </DetailRow>
              <DetailRow label="100% route">
                <span className="font-display text-lg leading-none">
                  {formatTimeEstimate(game.hltbCompletionistMinutes)}
                </span>
              </DetailRow>
              <DetailRow label="Updated">
                {hasCompletionTimes
                  ? formatDate(game.hltbUpdatedAt)
                  : "Not collected"}
              </DetailRow>
            </dl>
          </div>

          <div className="panel !p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="section-label !mb-0">Metacritic</span>
              {(metacriticLink?.storeUrl ?? game.metacriticUrl) ? (
                <a
                  href={metacriticLink?.storeUrl ?? game.metacriticUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-ink-soft transition-colors hover:text-ink"
                >
                  View
                </a>
              ) : null}
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-ink-soft">Metascore</p>
                <p className="text-xs text-ink-soft">
                  Best-effort from Steam Store metadata
                </p>
              </div>
              <strong className="font-display text-4xl font-medium leading-none">
                {hasMetacritic ? game.metacriticScore : "--"}
              </strong>
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              Updated:{" "}
              {hasMetacritic
                ? formatDate(game.metacriticUpdatedAt)
                : "Not collected"}
            </p>
          </div>

          {/* Stats mini-cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Owned by"
              value={formatNumber(owners.length)}
              className="bg-sage-soft"
            />
            <StatCard
              label="Still curious"
              value={formatNumber(wishlisters.length)}
              className="bg-sand-soft"
            />
          </div>

          {/* External links */}
          {(websites.length > 0 || game.providerLinks.length > 0) ? (
            <div className="panel !p-5">
              <span className="section-label">Links</span>
              <div className="grid gap-2">
                {game.providerLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.storeUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-[12px] border border-edge bg-surface p-2.5 text-sm font-semibold transition-colors hover:bg-canvas"
                  >
                    <span className="grid h-7 w-7 flex-none place-items-center rounded-[8px] bg-sky-soft text-chip font-display">
                      {link.provider.slice(0, 2)}
                    </span>
                    {link.provider === ExternalProvider.STEAM
                      ? "Steam Store"
                      : link.provider === ExternalProvider.HLTB
                        ? "HowLongToBeat"
                        : link.provider === ExternalProvider.METACRITIC
                          ? "Metacritic"
                          : link.provider === ExternalProvider.PLAYSTATION
                            ? "PlayStation"
                            : link.provider === ExternalProvider.XBOX
                              ? "Xbox"
                              : link.provider}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="ml-auto h-3.5 w-3.5 text-ink-soft/50">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                ))}
                {websites.slice(0, 4).map((url) => (
                  <a
                    key={String(url)}
                    href={String(url)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-[12px] border border-edge bg-surface p-2.5 text-sm transition-colors hover:bg-canvas"
                  >
                    <span className="grid h-7 w-7 flex-none place-items-center rounded-[8px] bg-canvas">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5 text-ink-soft">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                      </svg>
                    </span>
                    <span className="truncate text-ink-soft">
                      {String(url).replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="ml-auto h-3.5 w-3.5 flex-none text-ink-soft/50">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {/* Back link */}
          <Link
            href="/profile?tab=games"
            className="btn btn-ghost justify-center text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to library
          </Link>
        </aside>
      </div>
    </main>
  );
}

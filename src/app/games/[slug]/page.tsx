import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameBySlug } from "@/lib/catalog";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import {
  cn,
  formatDate,
  formatNumber,
  formatPlaytime,
  formatTimeEstimate,
} from "@/lib/utils";

export async function generateMetadata({
  params,
}: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);

  if (!game) {
    return {
      title: "Game not found | Checkpoint",
    };
  }

  return {
    title: `${game.name} | Checkpoint`,
    description:
      game.summary ??
      `Checkpoint catalog page for ${game.name}, enriched with IGDB metadata.`,
  };
}

export default async function GamePage({
  params,
}: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);

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
  const hltbLink = game.providerLinks.find((link) => link.provider === "HLTB");
  const hasCompletionTimes = Boolean(
    game.hltbMainStoryMinutes ||
      game.hltbMainExtraMinutes ||
      game.hltbCompletionistMinutes,
  );

  return (
    <main id="main-content" className="w-full max-w-[1200px] mx-auto grid gap-6 pb-10">
      {/* ── Cinematic Hero ── */}
      <section className="relative overflow-hidden rounded-[38px] border-3 border-ink shadow-hard">
        {/* Background hero image (blurred) */}
        {game.heroUrl || game.coverUrl ? (
          <div className="absolute inset-0">
            <img
              alt=""
              src={game.heroUrl ?? game.coverUrl ?? ""}
              className="w-full h-full object-cover blur-sm scale-105"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/30" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan/95 to-lime/90" />
        )}

        {/* Hero content */}
        <div className="relative z-10 p-8 pt-10 pb-10 grid grid-cols-[200px_1fr] gap-8 items-end max-md:grid-cols-1 max-md:gap-5">
          {/* Cover art */}
          <div className="w-[200px] aspect-[3/4] rounded-[22px] overflow-hidden border-3 border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.4)] max-md:w-[140px] max-md:mx-auto">
            {game.coverUrl ? (
              <img
                alt={`Cover art for ${game.name}`}
                src={game.coverUrl}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="grid place-items-center w-full h-full bg-gradient-to-b from-cyan/40 to-yellow/40 font-display text-2xl uppercase text-center p-4 text-ink">
                {game.name}
              </div>
            )}
          </div>

          {/* Title + quick info */}
          <div className="max-md:text-center">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-white/50 text-sm mb-3 max-md:justify-center" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-white/80 transition-colors">
                Home
              </Link>
              <span>/</span>
              <Link href="/profile?tab=games" className="hover:text-white/80 transition-colors">
                Games
              </Link>
              <span>/</span>
              <span className="text-white/80 truncate max-w-[20ch]">
                {game.name}
              </span>
            </nav>

            <h1 className="font-display text-[clamp(2rem,5vw,3.6rem)] leading-[0.95] uppercase text-white">
              {game.name}
            </h1>

            {/* Tags row */}
            <div className="flex items-center gap-2 flex-wrap mt-4 max-md:justify-center">
              {genres.slice(0, 3).map((genre) => (
                <span
                  key={String(genre)}
                  className="px-3 py-1 rounded-full text-[0.7rem] font-bold uppercase tracking-wide bg-white/15 text-white/90 backdrop-blur-sm border border-white/10"
                >
                  {String(genre)}
                </span>
              ))}
              {platforms.slice(0, 3).map((platform) => (
                <span
                  key={String(platform)}
                  className="px-3 py-1 rounded-full text-[0.7rem] font-bold uppercase tracking-wide bg-cyan/20 text-cyan backdrop-blur-sm border border-cyan/20"
                >
                  {String(platform)}
                </span>
              ))}
            </div>

            {/* Quick stats inline */}
            <div className="flex items-center gap-5 mt-5 max-md:justify-center">
              {hasRating ? (
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-[12px] grid place-items-center font-display text-sm border-2",
                      ratingValue >= 75
                        ? "bg-lime/90 border-lime text-ink"
                        : ratingValue >= 50
                          ? "bg-yellow/90 border-yellow text-ink"
                          : "bg-peach/90 border-peach text-white",
                    )}
                  >
                    {ratingValue}
                  </div>
                  <div className="text-xs text-white/60 leading-tight">
                    <span className="block text-white/80 font-semibold">
                      IGDB
                    </span>
                    {game.totalRatingCount
                      ? `${formatNumber(game.totalRatingCount)} ratings`
                      : "rating"}
                  </div>
                </div>
              ) : null}
              <div className="text-xs text-white/60 leading-tight">
                <span className="block text-white/80 font-semibold">
                  Released
                </span>
                {formatDate(game.releaseDate)}
              </div>
              <div className="text-xs text-white/60 leading-tight">
                <span className="block text-white/80 font-semibold">
                  Owners
                </span>
                {formatNumber(owners.length)} in catalog
              </div>
              {game.hltbMainStoryMinutes ? (
                <div className="text-xs text-white/60 leading-tight">
                  <span className="block text-white/80 font-semibold">
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
      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-6 max-lg:grid-cols-1">
        {/* ── Main Column ── */}
        <div className="grid gap-6">
          {/* About */}
          {game.summary ? (
            <section className="panel">
              <span className="section-label">About</span>
              <p className="text-[1.05rem] leading-relaxed">
                {game.summary}
              </p>
            </section>
          ) : null}

          {/* Screenshots */}
          {screenshots.length ? (
            <section className="panel">
              <div className="flex items-center justify-between gap-3.5 mb-5">
                <span className="section-label !mb-0">Screenshots</span>
                <span className="text-xs text-ink/50">
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
            <div className="flex items-center justify-between gap-3.5 mb-5">
              <span className="section-label !mb-0">Library activity</span>
              <span className="text-xs text-ink/50">
                {game.userEntries.length} {game.userEntries.length === 1 ? "collector" : "collectors"}
              </span>
            </div>

            {game.userEntries.length ? (
              <div className="grid gap-2.5">
                {game.userEntries.map((entry) => (
                  <div
                    className="flex items-center gap-4 p-3.5 rounded-[16px] bg-white border-2 border-ink/10 hover:border-ink/25 transition-colors"
                    key={entry.id}
                  >
                    {/* Avatar placeholder */}
                    <div className="w-9 h-9 flex-none rounded-full bg-gradient-to-br from-yellow/60 to-peach/60 border-2 border-ink/15 grid place-items-center font-display text-xs">
                      {(entry.user.displayName ?? "C").slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm truncate block">
                        {entry.user.displayName ?? "Collector"}
                      </span>
                      <span className="text-xs text-ink/50">
                        {formatPlaytime(entry.playtimeMinutes)}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[0.68rem] font-bold uppercase tracking-wide border-2",
                        entry.status === "OWNED" && "bg-lime/40 border-lime text-ink",
                        entry.status === "WISHLIST" && "bg-yellow/40 border-yellow text-ink",
                        entry.status === "PLAYING" && "bg-cyan/40 border-cyan text-ink",
                        entry.status === "COMPLETED" && "bg-peach/30 border-peach text-ink",
                        entry.status === "BACKLOG" && "bg-paper border-ink/20 text-ink/60",
                      )}
                    >
                      {entry.status.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center rounded-[18px] bg-paper/60 border-2 border-dashed border-ink/15">
                <p className="font-bold text-sm">No library activity yet.</p>
                <p className="text-xs text-ink/50 mt-1">
                  This page is a canonical metadata record ready for future ownership.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* ── Sidebar ── */}
        <aside className="grid gap-6 content-start max-lg:grid-cols-2 max-sm:grid-cols-1">
          {/* Game Details card */}
          <div className="panel !p-5">
            <span className="section-label">Details</span>
            <dl className="grid gap-3.5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink/50">Release</dt>
                <dd className="font-semibold text-right">
                  {formatDate(game.releaseDate)}
                </dd>
              </div>
              <div className="h-px bg-ink/8" />

              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink/50">Rating</dt>
                <dd className="font-semibold text-right">
                  {hasRating ? `${ratingValue} / 100` : "No rating"}
                </dd>
              </div>
              <div className="h-px bg-ink/8" />

              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink/50">Platforms</dt>
                <dd className="font-semibold text-right max-w-[18ch]">
                  {platforms.length
                    ? platforms.map(String).join(", ")
                    : "Unknown"}
                </dd>
              </div>
              <div className="h-px bg-ink/8" />

              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink/50">Genres</dt>
                <dd className="font-semibold text-right max-w-[18ch]">
                  {genres.length
                    ? genres.map(String).join(", ")
                    : "Unknown"}
                </dd>
              </div>
              <div className="h-px bg-ink/8" />

              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink/50">Source</dt>
                <dd className="font-semibold text-right">
                  {game.metadataSource ?? "Local catalog"}
                </dd>
              </div>
              <div className="h-px bg-ink/8" />

              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink/50">Providers</dt>
                <dd className="font-semibold text-right">
                  {formatNumber(game.providerLinks.length)} linked
                </dd>
              </div>
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
                  className="text-xs font-bold uppercase tracking-wide text-ink/55 hover:text-ink"
                >
                  View
                </a>
              ) : null}
            </div>
            <dl className="grid gap-3.5 text-sm mt-4">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink/50">Main story</dt>
                <dd className="font-display text-xl leading-none text-right">
                  {formatTimeEstimate(game.hltbMainStoryMinutes)}
                </dd>
              </div>
              <div className="h-px bg-ink/8" />

              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink/50">Main + extras</dt>
                <dd className="font-display text-xl leading-none text-right">
                  {formatTimeEstimate(game.hltbMainExtraMinutes)}
                </dd>
              </div>
              <div className="h-px bg-ink/8" />

              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink/50">Completionist</dt>
                <dd className="font-display text-xl leading-none text-right">
                  {formatTimeEstimate(game.hltbCompletionistMinutes)}
                </dd>
              </div>
              <div className="h-px bg-ink/8" />

              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink/50">Updated</dt>
                <dd className="font-semibold text-right">
                  {hasCompletionTimes
                    ? formatDate(game.hltbUpdatedAt)
                    : "Not collected"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Stats mini-cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-lime/20 border-3 border-ink rounded-[18px] text-center">
              <strong className="block font-display text-2xl leading-none">
                {formatNumber(owners.length)}
              </strong>
              <span className="block mt-1 text-[0.68rem] uppercase tracking-widest text-ink/60">
                Owners
              </span>
            </div>
            <div className="p-4 bg-yellow/20 border-3 border-ink rounded-[18px] text-center">
              <strong className="block font-display text-2xl leading-none">
                {formatNumber(wishlisters.length)}
              </strong>
              <span className="block mt-1 text-[0.68rem] uppercase tracking-widest text-ink/60">
                Wishlisted
              </span>
            </div>
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
                    className="flex items-center gap-3 p-2.5 rounded-[12px] bg-white border-2 border-ink/10 hover:border-ink/25 hover:bg-yellow/10 transition-colors text-sm font-semibold"
                  >
                    <span className="w-7 h-7 flex-none grid place-items-center rounded-[8px] bg-ink/5 text-[0.65rem] font-display uppercase">
                      {link.provider.slice(0, 2)}
                    </span>
                    {link.provider === "STEAM"
                      ? "Steam Store"
                      : link.provider === "HLTB"
                        ? "HowLongToBeat"
                        : link.provider}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 ml-auto text-ink/30">
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
                    className="flex items-center gap-3 p-2.5 rounded-[12px] bg-white border-2 border-ink/10 hover:border-ink/25 hover:bg-yellow/10 transition-colors text-sm"
                  >
                    <span className="w-7 h-7 flex-none grid place-items-center rounded-[8px] bg-ink/5">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-ink/40">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                      </svg>
                    </span>
                    <span className="truncate text-ink/70">
                      {String(url).replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 ml-auto text-ink/30 flex-none">
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
            className="btn btn-ghost text-sm justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to library
          </Link>
        </aside>
      </div>
    </main>
  );
}

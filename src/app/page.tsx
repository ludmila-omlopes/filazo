import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AuthDialog } from "@/components/auth-dialog";
import { GameCard, type GameCardGame } from "@/components/game-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { getDatabaseErrorMessage } from "@/lib/database-errors";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/utils";

const homeShowcaseSelect = {
  aggregatedRating: true,
  coverUrl: true,
  igdbId: true,
  metacriticScore: true,
  name: true,
  platforms: true,
  slug: true,
  summary: true,
  totalRatingCount: true,
  updatedAt: true,
  providerLinks: {
    select: {
      provider: true,
    },
  },
  userEntries: {
    select: {
      provider: true,
      source: true,
    },
  },
} satisfies Prisma.GameSelect;

type HomeShowcaseCandidate = Prisma.GameGetPayload<{
  select: typeof homeShowcaseSelect;
}>;

function asStringArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function hasPlayStationPlatform(platforms: string[]) {
  return platforms.some((platform) => /playstation|ps[1-5v]/i.test(platform));
}

function hasOnlyPlayStationShelfEntries(candidate: HomeShowcaseCandidate) {
  return (
    candidate.userEntries.length > 0 &&
    candidate.userEntries.every(
      (entry) => entry.provider === "PLAYSTATION" || entry.source === "PLAYSTATION",
    )
  );
}

function isSuspiciousCatalogCandidate(candidate: HomeShowcaseCandidate) {
  const platforms = asStringArray(candidate.platforms);
  const normalizedName = candidate.name.toLowerCase();
  const normalizedSummary = candidate.summary?.toLowerCase() ?? "";

  if (
    /\b(troph(?:y|ies)|skin|soundtrack|avatar|theme|add[\s-]?on|dlc|bundle)\b/i.test(
      normalizedName,
    )
  ) {
    return true;
  }

  if (
    /\b(unofficial|mobile port|easter egg|costume|addon|add-on)\b/i.test(
      normalizedSummary,
    )
  ) {
    return true;
  }

  if (
    hasOnlyPlayStationShelfEntries(candidate) &&
    platforms.length > 0 &&
    !hasPlayStationPlatform(platforms)
  ) {
    return true;
  }

  return false;
}

function hasStrongCatalogSignal(candidate: HomeShowcaseCandidate) {
  return candidate.aggregatedRating !== null || candidate.metacriticScore !== null;
}

function scoreCatalogCandidate(candidate: HomeShowcaseCandidate) {
  return (
    (candidate.aggregatedRating ?? 0) * 10 +
    (candidate.metacriticScore ?? 0) * 5 +
    Math.min(candidate.totalRatingCount ?? 0, 25) * 4
  );
}

function toShowcaseGame(candidate: HomeShowcaseCandidate): GameCardGame {
  return {
    coverUrl: candidate.coverUrl,
    name: candidate.name,
    slug: candidate.slug,
  };
}

function selectHomeShowcaseGames(candidates: HomeShowcaseCandidate[]) {
  const safeCandidates = candidates.filter(
    (candidate) => !isSuspiciousCatalogCandidate(candidate),
  );
  const orderedCandidates = [...safeCandidates].sort((left, right) => {
    const scoreDelta =
      scoreCatalogCandidate(right) - scoreCatalogCandidate(left);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });

  const strongCandidates = orderedCandidates.filter(hasStrongCatalogSignal);
  const showcaseGames = strongCandidates.slice(0, 8);

  if (showcaseGames.length >= 8) {
    return showcaseGames.map(toShowcaseGame);
  }

  const seenSlugs = new Set(showcaseGames.map((candidate) => candidate.slug));
  const fallbackCandidates = orderedCandidates.filter(
    (candidate) => !seenSlugs.has(candidate.slug),
  );

  return [...showcaseGames, ...fallbackCandidates]
    .slice(0, 8)
    .map(toShowcaseGame);
}

async function getHomeData() {
  try {
    const [catalogStats, enrichedStats, showcaseCandidates] =
      await Promise.all([
        prisma.game.aggregate({ _count: { id: true } }),
        prisma.game.aggregate({ _count: { igdbId: true } }),
        prisma.game.findMany({
          where: {
            coverUrl: { not: null },
            igdbId: { not: null },
            userEntries: {
              some: {},
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
          select: homeShowcaseSelect,
          take: 48,
        }),
      ]);

    return {
      catalogCount: catalogStats._count.id,
      enrichedCount: enrichedStats._count.igdbId,
      showcaseGames: selectHomeShowcaseGames(showcaseCandidates),
      databaseError: null,
    };
  } catch (error) {
    console.error("Could not load home catalog data.", error);

    return {
      catalogCount: 0,
      enrichedCount: 0,
      showcaseGames: [],
      databaseError: getDatabaseErrorMessage(error),
    };
  }
}

export default async function Home() {
  const { catalogCount, enrichedCount, showcaseGames, databaseError } =
    await getHomeData();

  return (
    <main
      id="main-content"
      className="mx-auto grid w-full max-w-[1100px] gap-24 overflow-visible pb-20 max-md:gap-16"
    >
      {databaseError ? (
        <Notice tone="error">
          {databaseError} Vercel deployments need a production database
          connection; this repo&apos;s SQLite file setup is intended for local
          development.
        </Notice>
      ) : null}

      <section className="relative min-h-[560px] overflow-hidden rounded-card border border-edge bg-dusk-deep text-cream shadow-float">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(135deg,rgba(159,153,209,0.18),rgba(134,186,218,0.1)_45%,rgba(255,227,179,0.14))]"
        />
        {showcaseGames.length ? (
          <CatalogHeroArtifacts games={showcaseGames.slice(0, 3)} />
        ) : null}

        <div className="relative z-10 flex min-h-[560px] items-center px-14 py-20 max-md:px-7 max-md:py-12">
          <div className="max-w-[620px]">
            <p className="text-kicker font-bold uppercase text-glow/90">
              Calm library for large game collections
            </p>
            <h1 className="mt-5 text-display font-normal leading-[1.03]">
              Every game list,
              <br />
              one readable catalog.
            </h1>
            <p className="mt-6 max-w-[45ch] text-lg leading-relaxed text-cream/75">
              filazo brings your game lists into one calm library, then keeps
              tonight&apos;s choice close at hand.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <AuthDialog
                triggerClassName="h-12 bg-cream px-7 text-base font-bold text-dusk-deep hover:bg-glow"
                triggerLabel="Sign in"
                triggerSize="lg"
              />
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="h-12 border border-cream/25 bg-cream/8 px-7 text-base font-semibold text-cream hover:bg-cream/14 hover:text-cream"
              >
                <Link href="/tonight">Open tonight</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="h-12 border border-cream/15 bg-transparent px-7 text-base font-semibold text-cream/85 hover:bg-cream/12 hover:text-cream"
              >
                <Link href="/profile">Add games</Link>
              </Button>
            </div>
            <p className="mt-5 text-sm text-cream/55">
              {formatNumber(catalogCount)} games indexed here. Browse, sort, or
              leave them waiting.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-8 px-4">
        <p className="text-center text-kicker font-bold uppercase text-ink-soft">
          How it works
        </p>

        <div className="grid grid-cols-3 gap-5 max-lg:grid-cols-1">
          <EveningStep
            number="01"
            title="Bring games in"
            line="Connect a source or upload a CSV when you want to fill the shelf."
          />
          <EveningStep
            number="02"
            title="Keep one clean shelf"
            line="The same game stays together even when it came from more than one place."
          />
          <EveningStep
            number="03"
            title="Choose without pressure"
            line="When you want to play, filazo keeps one fitting pick nearby without turning the rest into chores."
          />
        </div>
      </section>

      <section className="grid gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4 px-4">
          <div>
            <p className="section-label">The catalog</p>
            <h2 className="text-section-title">
              One library surface for every source.
            </h2>
          </div>
          <p className="max-w-[40ch] text-sm leading-relaxed text-ink-soft">
            {formatNumber(catalogCount)} games are already indexed. These are
            real catalog entries with enough metadata to represent the shelf
            cleanly.
          </p>
        </div>

        {showcaseGames.length ? (
          <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-3 max-md:grid-cols-2">
            {showcaseGames.map((game) => (
              <GameCard
                game={game}
                key={game.slug}
                platformName="Catalog"
                status="OWNED"
                variant="shelf"
              />
            ))}
          </div>
        ) : (
          <Card tactile className="mx-4">
            <CardContent className="p-6">
              <p className="font-semibold text-ink">No catalog showcase yet.</p>
              <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-ink-soft">
                Once real catalog entries have enough metadata, they appear
                here automatically.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="relative px-4 py-6 text-center">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none font-display text-[7rem] font-medium italic leading-none text-ink/4 max-md:text-[4.5rem]"
        >
          index
        </span>
        <blockquote className="relative mx-auto max-w-[24ch] font-display text-quote font-normal italic leading-snug">
          A library is allowed
          <br />
          to be unfinished.
          <br />
          Keep it readable.
          <br />
          Pick what fits.
        </blockquote>
      </section>

      <section className="relative overflow-hidden rounded-card border border-edge bg-dusk text-cream shadow-rest">
        <div aria-hidden className="absolute inset-x-0 top-0 h-2 bg-glow" />
        <div className="relative z-10 flex flex-col items-center gap-6 px-10 py-16 text-center max-md:px-6">
          <h2 className="max-w-[22ch] text-section-title font-normal leading-snug">
            Bring your records in.
            <br />
            Let the catalog stay legible.
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <AuthDialog
              triggerClassName="h-12 bg-cream px-7 text-base font-bold text-dusk-deep hover:bg-glow"
              triggerLabel="Sign in"
              triggerSize="lg"
            />
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="h-12 border border-cream/25 px-7 text-base font-semibold text-cream hover:bg-cream/10 hover:text-cream"
            >
              <Link href="/profile">Add games</Link>
            </Button>
          </div>
          <p className="text-xs text-cream/40">
            {formatNumber(enrichedCount)} games here already carry cover art,
            play times, and stories.
          </p>
        </div>
      </section>
    </main>
  );
}

function CatalogHeroArtifacts({ games }: { games: GameCardGame[] }) {
  if (!games.length) {
    return null;
  }

  const frontGame = games[0];
  const secondGame = games[1] ?? games[0];
  const thirdGame = games[2] ?? games[0];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute right-0 top-0 h-full w-[36%] min-w-[300px] border-l border-cream/10 bg-dusk/45 max-md:w-[54%] max-sm:opacity-45">
        <div className="grid h-full grid-cols-6 gap-2 p-5 opacity-85">
          {[
            "bg-sage",
            "bg-sky",
            "bg-sand",
            "bg-clay",
            "bg-dusk-lavender",
            "bg-cream/80",
          ].map((tone, index) => (
            <div
              className={`${tone} rounded-inner border border-cream/12 opacity-70`}
              key={`${tone}-${index}`}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-10 right-14 h-[330px] w-[280px] max-lg:right-7 max-md:bottom-6 max-md:opacity-60 max-sm:hidden">
        <CatalogCard
          className="absolute left-1 top-10 rotate-[-7deg] opacity-55"
          game={secondGame}
          marker="CSV"
        />
        <CatalogCard
          className="absolute right-0 top-0 rotate-[5deg] opacity-70"
          game={thirdGame}
          marker="Metadata"
        />
        <CatalogCard
          className="absolute left-8 top-20 shadow-float"
          game={frontGame}
          marker="Tonight"
          note="short return"
        />
      </div>
    </div>
  );
}

function CatalogCard({
  className,
  game,
  marker,
  note = "catalog entry",
}: {
  className?: string;
  game: GameCardGame;
  marker: string;
  note?: string;
}) {
  return (
    <div
      className={`w-[230px] rounded-card border border-cream/25 bg-cream p-4 text-dusk-deep shadow-lift ${className ?? ""}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-dusk-deep/15 pb-3">
        <span className="text-xs font-bold uppercase text-dusk-deep/65">
          {marker}
        </span>
        <span className="h-3 w-8 rounded-[2px] bg-glow" />
      </div>
      <div className="aspect-[3/4] rounded-inner border border-dusk-deep/15 bg-sage-soft p-3">
        <div className="grid h-full place-items-center rounded-[6px] border border-dusk-deep/10 bg-cream/85 text-center font-display text-xl leading-tight text-dusk-deep">
          {game.name}
        </div>
      </div>
      <p className="mt-3 text-sm font-bold">{note}</p>
    </div>
  );
}

function EveningStep({
  number,
  title,
  line,
}: {
  number: string;
  title: string;
  line: string;
}) {
  return (
    <Card tactile className="py-0">
      <CardContent className="flex items-start gap-5 p-6">
          <span className="font-display text-[4rem] font-normal italic leading-none text-sage/70 max-sm:text-[3rem]">
          {number}
        </span>
        <div className="pt-2">
          <h2 className="font-display text-2xl font-medium">{title}</h2>
          <p className="mt-2 max-w-[38ch] leading-relaxed text-ink-soft">
            {line}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

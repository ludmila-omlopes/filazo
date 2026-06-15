import Link from "next/link";
import { GameCard, type GameCardGame } from "@/components/game-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { getProfileData } from "@/lib/catalog";
import { getDatabaseErrorMessage } from "@/lib/database-errors";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { formatNumber } from "@/lib/utils";

const fallbackGames: GameCardGame[] = [
  {
    name: "Harbor Index",
    slug: "harbor-index",
    coverUrl: null,
  },
  {
    name: "Mosslight Valley",
    slug: "mosslight-valley",
    coverUrl: null,
  },
  {
    name: "Station After Rain",
    slug: "station-after-rain",
    coverUrl: null,
  },
  {
    name: "Letters From Low Orbit",
    slug: "letters-from-low-orbit",
    coverUrl: null,
  },
  {
    name: "The Long Garden",
    slug: "the-long-garden",
    coverUrl: null,
  },
  {
    name: "Pocket Harbor",
    slug: "pocket-harbor",
    coverUrl: null,
  },
  {
    name: "Tiny Engines After Hours",
    slug: "tiny-engines-after-hours",
    coverUrl: null,
  },
  {
    name: "After the Credits",
    slug: "after-the-credits",
    coverUrl: null,
  },
];

async function getHomeData() {
  const userId = await getSessionUserId();

  try {
    const [catalogStats, enrichedStats, sampleGames, profile] =
      await Promise.all([
        prisma.game.aggregate({ _count: { id: true } }),
        prisma.game.aggregate({ _count: { igdbId: true } }),
        prisma.game.findMany({
          orderBy: { updatedAt: "desc" },
          select: {
            coverUrl: true,
            name: true,
            slug: true,
          },
          take: 8,
        }),
        userId ? getProfileData(userId) : Promise.resolve(null),
      ]);

    return {
      userId,
      profile,
      catalogCount: catalogStats._count.id,
      enrichedCount: enrichedStats._count.igdbId,
      sampleGames,
      databaseError: null,
    };
  } catch (error) {
    console.error("Could not load home catalog data.", error);

    return {
      userId,
      profile: null,
      catalogCount: 0,
      enrichedCount: 0,
      sampleGames: fallbackGames,
      databaseError: getDatabaseErrorMessage(error),
    };
  }
}

export default async function Home() {
  const { catalogCount, enrichedCount, sampleGames, databaseError } =
    await getHomeData();
  const shelfGames = sampleGames.length ? sampleGames : fallbackGames;

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
        <CatalogHeroArtifacts games={shelfGames.slice(0, 3)} />

        <div className="relative z-10 flex min-h-[560px] items-center px-14 py-20 max-md:px-7 max-md:py-12">
          <div className="max-w-[620px]">
            <p className="text-kicker font-bold uppercase text-glow/90">
              Canonical catalog for large libraries
            </p>
            <h1 className="mt-5 text-display font-normal leading-[1.03]">
              Every game list,
              <br />
              one readable catalog.
            </h1>
            <p className="mt-6 max-w-[45ch] text-lg leading-relaxed text-cream/75">
              filazo brings Steam, CSVs, PlayStation, and Xbox records into one
              calm library, then keeps tonight&apos;s choice close at hand.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="h-12 bg-cream px-7 text-base font-bold text-dusk-deep hover:bg-glow"
              >
                <a href="/api/auth/steam">Connect Steam</a>
              </Button>
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
                <Link href="/profile">Import a CSV</Link>
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
          How the catalog settles
        </p>

        <div className="grid grid-cols-3 gap-5 max-lg:grid-cols-1">
          <EveningStep
            number="01"
            title="Bring records in"
            line="Steam can sync directly. CSV, PlayStation, and Xbox lists have a place too."
          />
          <EveningStep
            number="02"
            title="Resolve the catalog"
            line="Provider IDs, IGDB matches, and normalized titles fold scattered lists into one game entry."
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
            {formatNumber(catalogCount)} games are already indexed. A few of
            them are enough to show how the collection reads.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-3 max-md:grid-cols-2">
          {shelfGames.slice(0, 8).map((game) => (
            <GameCard
              game={game}
              key={game.slug}
              platformName="Catalog"
              status="OWNED"
              variant="shelf"
            />
          ))}
        </div>
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
            <Button
              asChild
              size="lg"
              className="h-12 bg-cream px-7 text-base font-bold text-dusk-deep hover:bg-glow"
            >
              <a href="/api/auth/steam">Connect Steam</a>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="h-12 border border-cream/25 px-7 text-base font-semibold text-cream hover:bg-cream/10 hover:text-cream"
            >
              <Link href="/profile">Import a CSV</Link>
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
  const stackedGames = [...games, ...fallbackGames].slice(0, 3);
  const [frontGame, secondGame, thirdGame] = stackedGames;

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
          marker="IGDB"
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

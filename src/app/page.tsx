import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { getProfileData } from "@/lib/catalog";
import { getDatabaseErrorMessage } from "@/lib/database-errors";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { formatNumber } from "@/lib/utils";

async function getHomeData() {
  const userId = await getSessionUserId();

  try {
    const [catalogStats, enrichedStats, profile] = await Promise.all([
      prisma.game.aggregate({ _count: { id: true } }),
      prisma.game.aggregate({ _count: { igdbId: true } }),
      userId ? getProfileData(userId) : Promise.resolve(null),
    ]);

    return {
      userId,
      profile,
      catalogCount: catalogStats._count.id,
      enrichedCount: enrichedStats._count.igdbId,
      databaseError: null,
    };
  } catch (error) {
    console.error("Could not load home catalog data.", error);

    return {
      userId,
      profile: null,
      catalogCount: 0,
      enrichedCount: 0,
      databaseError: getDatabaseErrorMessage(error),
    };
  }
}

export default async function Home() {
  const { catalogCount, enrichedCount, databaseError } = await getHomeData();

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

      {/* ═══ Hero — dusk sanctuary ═══ */}
      <section className="relative overflow-hidden rounded-[36px] bg-dusk-deep text-cream shadow-[0_40px_90px_rgba(34,43,37,0.35)]">
        {/* Ambient light */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-40 h-[480px] w-[480px] rounded-full bg-glow/25 blur-[110px] animate-breathe"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-48 right-[18%] h-[420px] w-[420px] rounded-full bg-sage/15 blur-[110px] animate-breathe [animation-delay:-4.5s]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-[-90px] top-[-60px] h-[300px] w-[300px] rounded-full bg-sky/10 blur-[90px]"
        />

        <div className="relative z-10 grid grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] items-center gap-12 px-14 py-20 max-lg:grid-cols-1 max-lg:gap-14 max-md:px-7 max-md:py-12">
          <div className="flex min-w-0 flex-col items-start gap-7">
            <p className="text-kicker font-bold uppercase tracking-[0.28em] text-glow/90">
              For players with too many games
            </p>
            <h1 className="text-display font-normal leading-[1.04] tracking-[-0.015em]">
              Make peace with
              <br />
              your shelf.
              <br />
              <em className="serif-accent text-glow">Befriend it.</em>
            </h1>
            <p className="max-w-[40ch] text-lg leading-relaxed text-cream/70">
              filazo turns the games waiting for someday into a quiet library —
              and hands you one gentle pick for tonight.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-cream px-7 text-base font-bold text-dusk-deep hover:bg-glow"
              >
                <a href="/api/auth/steam">Connect Steam</a>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="h-12 rounded-full border border-cream/25 px-7 text-base font-semibold text-cream hover:bg-cream/10 hover:text-cream"
              >
                <Link href="/profile">Bring a CSV instead</Link>
              </Button>
            </div>
            <p className="mt-2 text-sm text-cream/45">
              {formatNumber(catalogCount)} games already rest here. None of
              them are deadlines.
            </p>
          </div>

          <TonightStack />
        </div>
      </section>

      {/* ═══ An evening with filazo — editorial steps ═══ */}
      <section className="relative grid gap-2 px-4">
        <p className="text-center text-kicker font-bold uppercase tracking-[0.28em] text-ink-soft">
          An evening with filazo
        </p>

        <EveningStep
          number="01"
          align="left"
          title="Gather"
          line="Steam syncs itself. Spreadsheets and PlayStation lists fold in. Cover art arrives on its own."
        />
        <EveningStep
          number="02"
          align="right"
          title="Settle"
          line="Duplicates merge into one canonical shelf. Every game gets a place — owned, still curious, or simply resting."
        />
        <EveningStep
          number="03"
          align="left"
          title="Play"
          line="Ask for one pick that fits the hours you actually have. Play it, or don't. The shelf will keep."
          last
        />
      </section>

      {/* ═══ Manifesto interlude ═══ */}
      <section className="relative px-4 py-6 text-center">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none font-display text-[clamp(5rem,16vw,11rem)] font-medium italic leading-none text-ink/4"
        >
          breathe
        </span>
        <blockquote className="relative mx-auto max-w-[24ch] font-display text-quote font-normal italic leading-snug">
          “A shelf is a library,
          <br />
          not an assignment.”
        </blockquote>
        <p className="relative mt-5 text-sm text-ink-soft">
          Libraries are meant to be bigger than one lifetime. That&apos;s what
          makes them wonderful.
        </p>
      </section>

      {/* ═══ Closing — back to the dusk ═══ */}
      <section className="relative overflow-hidden rounded-[36px] bg-dusk text-cream">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-32 h-[380px] w-[380px] rounded-full bg-glow/20 blur-[100px] animate-breathe"
        />
        <div className="relative z-10 flex flex-col items-center gap-6 px-10 py-16 text-center max-md:px-6">
          <h2 className="max-w-[22ch] text-[clamp(1.6rem,3.4vw,2.4rem)] font-normal leading-snug">
            Tonight, play <em className="serif-accent text-glow">one</em> game.
            Let the rest sleep.
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-cream px-7 text-base font-bold text-dusk-deep hover:bg-glow"
            >
              <a href="/api/auth/steam">Connect Steam</a>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="h-12 rounded-full border border-cream/25 px-7 text-base font-semibold text-cream hover:bg-cream/10 hover:text-cream"
            >
              <Link href="/profile">Open your library</Link>
            </Button>
          </div>
          <p className="text-xs text-cream/40">
            {formatNumber(enrichedCount)} games here already carry their own
            cover art, play times, and stories.
          </p>
        </div>
      </section>
    </main>
  );
}

/* Stacked, tilted "tonight's pick" cards drifting slowly in the hero. */
function TonightStack() {
  return (
    <div
      className="relative mx-auto h-[360px] w-[290px] max-lg:h-[330px]"
      aria-label="Example: tonight's gentle pick"
    >
      {/* Back cards */}
      <div
        aria-hidden
        className="absolute left-2 top-7 h-[290px] w-[225px] rounded-[20px] bg-cream/6 backdrop-blur-[2px] [--card-tilt:-7deg] animate-drift-slow [animation-delay:-3s]"
      />
      <div
        aria-hidden
        className="absolute right-0 top-3 h-[300px] w-[235px] rounded-[20px] bg-cream/10 [--card-tilt:5deg] animate-drift-slow [animation-delay:-6s]"
      />

      {/* Front card */}
      <div className="absolute left-1/2 top-1/2 w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-[22px] bg-cream p-3 text-dusk-deep shadow-[0_30px_60px_rgba(0,0,0,0.4)] [--card-tilt:-2deg] animate-drift-slow">
        <div className="overflow-hidden rounded-[14px]">
          <PickCover />
        </div>
        <div className="px-2 pb-2 pt-3">
          <p className="text-micro font-bold uppercase tracking-[0.22em] text-dusk-mist">
            Tonight&apos;s gentle pick
          </p>
          <p className="mt-1 font-display text-xl">Neon Drift</p>
          <p className="mt-1.5 text-xs leading-relaxed text-dusk-mist">
            About 3 hours left — it fits your evening with room to spare.
          </p>
        </div>
      </div>
    </div>
  );
}

function PickCover() {
  return (
    <svg
      viewBox="0 0 250 150"
      className="w-full"
      role="img"
      aria-label="Stylized game cover artwork"
    >
      <rect width="250" height="150" fill="var(--color-dusk)" />
      <circle cx="190" cy="42" r="22" fill="var(--color-glow)" opacity="0.9" />
      <path d="M0 150 L62 88 L115 150 Z" fill="var(--color-sage)" opacity="0.5" />
      <path d="M70 150 L148 70 L226 150 Z" fill="var(--color-sage)" opacity="0.75" />
      <path d="M170 150 L228 100 L250 150 Z" fill="var(--color-sky)" opacity="0.55" />
    </svg>
  );
}

function EveningStep({
  number,
  title,
  line,
  align,
  last = false,
}: {
  number: string;
  title: string;
  line: string;
  align: "left" | "right";
  last?: boolean;
}) {
  return (
    <div
      className={`relative grid grid-cols-2 max-md:grid-cols-1 ${
        last ? "" : "pb-16 max-md:pb-10"
      }`}
    >
      {/* Center spine */}
      {!last ? (
        <span
          aria-hidden
          className="absolute left-1/2 top-16 bottom-0 w-px -translate-x-1/2 bg-edge max-md:hidden"
        />
      ) : null}

      <div
        className={`flex items-start gap-6 ${
          align === "right"
            ? "col-start-2 pl-14 max-md:col-start-1 max-md:pl-0"
            : "col-start-1 pr-14 max-md:pr-0"
        }`}
      >
        <span className="font-display text-[clamp(3rem,7vw,4.6rem)] font-normal italic leading-none text-sage/70">
          {number}
        </span>
        <div className="pt-2">
          <h2 className="font-display text-2xl font-medium">{title}</h2>
          <p className="mt-2 max-w-[38ch] leading-relaxed text-ink-soft">
            {line}
          </p>
        </div>
      </div>
    </div>
  );
}

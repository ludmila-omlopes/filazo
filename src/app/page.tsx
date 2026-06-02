import Link from "next/link";
import { getProfileData } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { formatDate, formatNumber } from "@/lib/utils";

const workflowSteps = [
  {
    eyebrow: "01 / Steam",
    title: "Sync the shelf you already own.",
    body: "Steam sign-in pulls owned games, playtime, and profile context into one collection view.",
    tone: "bg-yellow",
  },
  {
    eyebrow: "02 / CSV",
    title: "Rescue every backlog export.",
    body: "Map title, platform, status, notes, and hours from CSV files without making a second library.",
    tone: "bg-cyan",
  },
  {
    eyebrow: "03 / Catalog",
    title: "Merge provider noise into one game.",
    body: "Provider IDs, IGDB matches, and normalized titles attach to canonical game records.",
    tone: "bg-lime",
  },
];

export default async function Home() {
  const [userId, catalogStats, enrichedStats] = await Promise.all([
    getSessionUserId(),
    prisma.game.aggregate({
      _count: {
        id: true,
      },
    }),
    prisma.game.aggregate({
      _count: {
        igdbId: true,
      },
    }),
  ]);

  const profile = userId ? await getProfileData(userId) : null;
  const wishlistCount = profile?.wishlistEntries.length ?? 0;
  const latestImport = profile?.latestImport ?? null;

  return (
    <main id="main-content" className="w-full max-w-[1200px] mx-auto grid gap-6 overflow-hidden pb-9">
      <section className="hero-dashed-inset overflow-hidden grid grid-cols-[minmax(0,1.02fr)_minmax(320px,0.98fr)] gap-6 p-8 bg-yellow border-3 border-ink rounded-[38px] shadow-hard max-lg:grid-cols-1 max-md:p-5">
        <div className="relative z-10 flex min-w-0 flex-col justify-between">
          <div>
            <p className="section-label">Backlog assistant / canonical catalog</p>
            <h1 className="max-w-[12ch] text-wrap font-display text-[clamp(2.7rem,7.5vw,5.9rem)] leading-[0.95] tracking-wide uppercase max-lg:max-w-none max-sm:max-w-[7ch] max-sm:text-[clamp(2.2rem,12vw,3rem)]">
              Decide what to play next.
            </h1>
            <p className="mt-[18px] max-w-[38rem] text-[clamp(1rem,2vw,1.22rem)] font-medium leading-relaxed">
              Playprint turns Steam syncs, backlog spreadsheets, wishlists, and
              IGDB metadata into one normalized game catalog, then helps you
              read the pile instead of staring at it.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3.5">
            <a className="btn btn-primary" href="/api/auth/steam">
              Connect Steam
            </a>
            <Link className="btn btn-ghost" href="/profile">
              Import CSV
            </Link>
            <Link className="btn btn-ghost" href="/profile?tab=assistant">
              Review assistant
            </Link>
          </div>
        </div>

        <aside className="relative z-10 grid min-w-0 gap-4" aria-label="Backlog assistant snapshot">
          <div className="border-3 border-ink rounded-[28px] bg-paper shadow-hard overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b-3 border-ink bg-ink px-5 py-3 text-white max-sm:flex-wrap max-sm:px-4">
              <span className="font-display text-sm uppercase tracking-wide">
                Assistant queue
              </span>
              <span className="rounded-pill border-2 border-white px-3 py-1 text-xs font-bold uppercase">
                Live model
              </span>
            </div>
            <div className="grid gap-3 p-5 max-sm:p-4">
              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                <StatTile label="Wishlist" value={formatNumber(wishlistCount)} />
                <StatTile label="Catalog" value={formatNumber(catalogStats._count.id)} />
              </div>
              <div className="rounded-[22px] border-3 border-ink bg-lime p-4 shadow-hard-xs">
                <p className="section-label !mb-2">Next decision</p>
                <h2 className="text-[clamp(1.35rem,3vw,2rem)] leading-tight">
                  Shortlist games with enough context to choose quickly.
                </h2>
                <p className="mt-2 leading-relaxed">
                  Prioritize by ownership, backlog status, playtime, last sync,
                  completion data, and enriched metadata.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm font-bold max-sm:grid-cols-1">
                <div className="rounded-[18px] border-3 border-ink bg-cyan p-3">
                  {formatNumber(enrichedStats._count.igdbId)} IGDB-enriched
                </div>
                <div className="rounded-[18px] border-3 border-ink bg-peach p-3">
                  Latest import: {latestImport ? formatDate(latestImport.createdAt) : "not yet"}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid grid-cols-3 gap-6 max-lg:grid-cols-1">
        {workflowSteps.map((step) => (
          <article className={`card card-hover ${step.tone}`} key={step.eyebrow}>
            <span className="section-label">{step.eyebrow}</span>
            <h2 className="mb-2.5 text-[clamp(1.45rem,3vw,2.15rem)] leading-[1.05]">
              {step.title}
            </h2>
            <p className="leading-relaxed">{step.body}</p>
          </article>
        ))}
      </section>

      <section className="panel flex items-center justify-between gap-6 bg-peach max-lg:flex-col max-lg:items-start">
        <div className="min-w-0">
          <span className="section-label">V1 action path</span>
          <h2 className="max-w-[18ch] text-[clamp(1.8rem,4vw,3.1rem)] leading-[1.02]">
            Bring the backlog in. Let the assistant make it readable.
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3.5">
          <a className="btn btn-primary" href="/api/auth/steam">
            Connect Steam
          </a>
          <Link className="btn btn-ghost" href="/profile">
            Import CSV
          </Link>
        </div>
      </section>
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border-3 border-ink bg-white p-3">
      <span className="stat-label !mb-1">{label}</span>
      <strong className="font-display text-[clamp(1.5rem,4vw,2.4rem)] leading-none">
        {value}
      </strong>
    </div>
  );
}

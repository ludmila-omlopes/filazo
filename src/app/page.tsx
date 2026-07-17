import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import type { Prisma } from "@prisma/client";
import { AuthDialog } from "@/components/auth-dialog";
import { GameCard, type GameCardGame } from "@/components/game-card";
import { SafeImage } from "@/components/safe-image";
import { PhaseBadge } from "@/components/theme-runtime";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { getDatabaseErrorMessage } from "@/lib/database-errors";
import { createTranslator } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";
import { FILAZO_THEME_COOKIE, parseFilazoThemeMode } from "@/lib/theme";
import { cn, formatNumber } from "@/lib/utils";

/** Frosted-glass surface for landing cards over the time-of-day gradient,
 *  matching the scrolled site header. */
const GLASS_CARD = "border-edge/70 bg-surface/65 backdrop-blur-md";

/** Glass highlight for the call-to-action: the same frosted surface as the
 *  cards (so it no longer reads as a heavy dark block) with a lilac accent
 *  border + glow bar to keep it the page's highlight. Theme-aware content. */
const GLASS_HIGHLIGHT = "border-sage/40 bg-surface/70 backdrop-blur-md";

/** Glowing lilac primary CTA (image-2 style). Sage stays a light lilac in both
 *  themes, so the fixed dark text reads on the light day and dark night pages. */
const HERO_CTA =
  "h-12 bg-sage px-7 text-base font-bold text-dusk-deep shadow-[0_10px_34px_-10px_rgba(159,153,209,0.85)] hover:bg-sage/90";

/** Theme-aware secondary button for the container-less hero — `ink` flips with
 *  the theme, so it reads on the light day page and the dark night page. */
const HERO_GHOST_BUTTON =
  "h-12 border border-ink/15 bg-ink/5 px-7 text-base font-semibold text-ink hover:bg-ink/10";

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
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const sessionUserId = await getSessionUserId();

  if (sessionUserId) {
    redirect("/profile");
  }

  const cookieStore = await cookies();
  const mode = parseFilazoThemeMode(
    cookieStore.get(FILAZO_THEME_COOKIE)?.value,
  );
  const homeData = await getHomeData();
  const { catalogCount, enrichedCount, showcaseGames, databaseError } =
    homeData;
  const isSignedIn = Boolean(sessionUserId);
  const shouldShowDatabaseNotice =
    Boolean(databaseError) &&
    (isSignedIn || process.env.NODE_ENV !== "production");
  const databaseNotice = shouldShowDatabaseNotice
    ? t("landing.notice.database", { message: databaseError ?? "" })
    : null;

  return (
    <main
      id="main-content"
      className="mx-auto grid w-full max-w-[1100px] gap-24 overflow-visible pb-20 max-md:gap-16"
    >
      {databaseNotice ? <Notice tone="error">{databaseNotice}</Notice> : null}

      <section className="relative min-h-[540px] overflow-visible">
        <HeroAtmosphere />
        <div className="absolute right-0 top-1 z-20 max-md:hidden">
          <PhaseBadge locale={locale} mode={mode} />
        </div>
        {showcaseGames.length ? (
          <CatalogHeroArtifacts games={showcaseGames.slice(0, 3)} />
        ) : null}

        <div className="relative z-10 flex min-h-[540px] items-center px-4 py-12 max-md:py-8">
          <div className="max-w-[620px]">
            <h1 className="text-display font-normal leading-[1.03] text-ink">
              {t("landing.title").split("\n")[0]},
              <br />
              {t("landing.title").split("\n")[1]}
            </h1>
            <p className="mt-6 max-w-[45ch] text-lg leading-relaxed text-ink-soft">
              {t("landing.body")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {isSignedIn ? (
                <Button asChild size="lg" className={HERO_CTA}>
                  <Link href="/profile">{t("landing.openLibrary")}</Link>
                </Button>
              ) : (
                <AuthDialog
                  triggerClassName={HERO_CTA}
                  triggerLabel={t("auth.trigger.signIn")}
                  triggerSize="lg"
                />
              )}
              <Button
                asChild
                variant="ghost"
                size="lg"
                className={HERO_GHOST_BUTTON}
              >
                <Link href="/tonight">{t("landing.openTonight")}</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className={HERO_GHOST_BUTTON}
              >
                <Link href="/profile?tab=integrations">{t("common.addGames")}</Link>
              </Button>
            </div>
            <p className="mt-5 text-sm text-ink-soft">
              {t("landing.indexedCount", {
                count: formatNumber(catalogCount, locale),
              })}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-8 px-4">
        <p className="text-center text-kicker font-bold uppercase text-ink-soft">
          {t("landing.howItWorks")}
        </p>

        <div className="grid grid-cols-3 gap-5 max-lg:grid-cols-1">
          <EveningStep
            number="01"
            title={t("landing.step1Title")}
            line={t("landing.step1Body")}
          />
          <EveningStep
            number="02"
            title={t("landing.step2Title")}
            line={t("landing.step2Body")}
          />
          <EveningStep
            number="03"
            title={t("landing.step3Title")}
            line={t("landing.step3Body")}
          />
        </div>
      </section>

      <section className="grid gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4 px-4">
          <div>
            <p className="section-label">{t("landing.catalogLabel")}</p>
            <h2 className="text-section-title">
              {t("landing.catalogTitle")}
            </h2>
          </div>
        </div>

        {showcaseGames.length ? (
          <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-3 max-md:grid-cols-2">
            {showcaseGames.map((game) => (
              <GameCard
                className={GLASS_CARD}
                game={game}
                key={game.slug}
                platformName="Catalog"
                status="OWNED"
                variant="shelf"
              />
            ))}
          </div>
        ) : (
          <Card tactile className={cn("mx-4", GLASS_CARD)}>
            <CardContent className="p-6">
              <p className="font-semibold text-ink">
                {t("landing.noShowcaseTitle")}
              </p>
              <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-ink-soft">
                {t("landing.noShowcaseBody")}
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
          {t("landing.quote").split("\n").map((line) => (
            <span className="block" key={line}>
              {line}
            </span>
          ))}
        </blockquote>
      </section>

      <section
        className={cn(
          "relative overflow-hidden rounded-card border text-ink shadow-lift",
          GLASS_HIGHLIGHT,
        )}
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-2 bg-glow" />
        <div className="relative z-10 flex flex-col items-center gap-6 px-10 py-16 text-center max-md:px-6">
          <h2 className="max-w-[22ch] text-section-title font-normal leading-snug">
            {t("landing.ctaTitle").split("\n")[0]}
            <br />
            {t("landing.ctaTitle").split("\n")[1]}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {isSignedIn ? (
              <Button asChild size="lg" className={HERO_CTA}>
                <Link href="/profile">{t("landing.openLibrary")}</Link>
              </Button>
            ) : (
              <AuthDialog
                triggerClassName={HERO_CTA}
                triggerLabel={t("auth.trigger.signIn")}
                triggerSize="lg"
              />
            )}
            <Button
              asChild
              variant="ghost"
              size="lg"
              className={HERO_GHOST_BUTTON}
            >
              <Link href="/profile?tab=integrations">{t("common.addGames")}</Link>
            </Button>
          </div>
          <p className="text-xs text-ink-soft">
            {t("landing.ctaFoot", {
              count: formatNumber(enrichedCount, locale),
            })}
          </p>
        </div>
      </section>
    </main>
  );
}

/** Ambient hero backdrop: a few slow-drifting pastel blobs on the palette,
 *  finished with a faint printed-paper grain. Purely decorative and
 *  theme-aware — the accent tokens flip with day/night on their own. */
function HeroAtmosphere() {
  const blobs: Array<{
    className: string;
    style: CSSProperties;
  }> = [
    {
      className: "left-[-6%] top-[-8%] h-[360px] w-[360px] bg-sage/45",
      style: { "--blob-dx": "26px", "--blob-dy": "-22px", animationDelay: "-3s" } as CSSProperties,
    },
    {
      className: "right-[-4%] top-[6%] h-[300px] w-[300px] bg-clay/40",
      style: { "--blob-dx": "-30px", "--blob-dy": "18px", animationDelay: "-11s" } as CSSProperties,
    },
    {
      className: "bottom-[-12%] left-[24%] h-[340px] w-[340px] bg-sky/35",
      style: { "--blob-dx": "20px", "--blob-dy": "24px", animationDelay: "-7s" } as CSSProperties,
    },
    {
      className: "bottom-[8%] right-[26%] h-[220px] w-[220px] bg-dusk-lavender/40",
      style: { "--blob-dx": "-18px", "--blob-dy": "-16px", animationDelay: "-15s" } as CSSProperties,
    },
  ];

  return (
    <div
      aria-hidden
      className="hero-wave-mask pointer-events-none absolute -bottom-[72px] left-1/2 z-0 w-screen -translate-x-1/2 overflow-hidden -top-40 max-sm:-top-56"
    >
      {blobs.map((blob, index) => (
        <div
          className={cn(
            "animate-drift-blob absolute rounded-full blur-3xl",
            blob.className,
          )}
          key={index}
          style={blob.style}
        />
      ))}
      <div className="hero-grain absolute inset-0" />
    </div>
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
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      <div className="absolute right-0 top-0 h-full w-[36%] min-w-[300px] max-md:w-[54%] max-sm:opacity-45">
        <div className="grid h-full grid-cols-6 gap-2 p-5 opacity-50">
          {[
            "bg-sage",
            "bg-sky",
            "bg-sand",
            "bg-clay",
            "bg-dusk-lavender",
            "bg-ink/15",
          ].map((tone, index) => (
            <div
              className={`${tone} rounded-inner border border-ink/10 opacity-70`}
              key={`${tone}-${index}`}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-10 right-14 h-[330px] w-[280px] max-lg:right-7 max-md:bottom-6 max-md:opacity-60 max-sm:hidden">
        <CatalogCard
          className="absolute left-1 top-10 opacity-55"
          delay="-5.3s"
          game={secondGame}
          tilt={-7}
        />
        <CatalogCard
          className="absolute right-0 top-0 opacity-70"
          delay="-2.6s"
          game={thirdGame}
          tilt={5}
        />
        <CatalogCard
          className="absolute left-8 top-20 shadow-float"
          game={frontGame}
          tilt={-2}
        />
      </div>
    </div>
  );
}

function CatalogCard({
  className,
  game,
  tilt = 0,
  delay = "0s",
}: {
  className?: string;
  game: GameCardGame;
  tilt?: number;
  delay?: string;
}) {
  return (
    <div
      className={cn(
        "printed-cover relative aspect-[3/4] w-[230px] overflow-hidden rounded-card border border-ink/10 bg-sage-soft shadow-lift animate-drift-slow",
        className,
      )}
      style={
        {
          "--card-tilt": `${tilt}deg`,
          transform: `rotate(${tilt}deg)`,
          animationDelay: delay,
        } as CSSProperties
      }
    >
      {game.coverUrl ? (
        <SafeImage
          alt=""
          className="object-cover"
          fallback={
            <div className="grid h-full place-items-center bg-cream/85 p-3 text-center font-display text-lg leading-tight text-dusk-deep">
              {game.name}
            </div>
          }
          fill
          sizes="230px"
          src={game.coverUrl}
        />
      ) : (
        <div className="grid h-full place-items-center bg-cream/85 p-3 text-center font-display text-lg leading-tight text-dusk-deep">
          {game.name}
        </div>
      )}
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
    <Card tactile className={cn(GLASS_CARD, "py-0")}>
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

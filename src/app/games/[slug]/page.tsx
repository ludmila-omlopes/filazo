import { notFound } from "next/navigation";
import { AdSenseBanner } from "@/components/adsense-banner";
import { GameMemoryCard } from "./_components/game-memory-card";
import { getGameBySlug, getGameMetadataBySlug } from "@/lib/catalog";
import { isIndexableGame } from "@/lib/game-indexing";
import { createTranslator } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";
import { createPageMetadata } from "@/lib/site-metadata";

export async function generateMetadata({
  params,
}: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  const [game, locale] = await Promise.all([getGameMetadataBySlug(slug), getRequestLocale()]);
  const t = createTranslator(locale);

  if (!game) {
    return {
      title: t("game.notFound"),
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const metadata = createPageMetadata({
    title: game.name,
    description:
      (locale === "en" ? game.summary : null) ?? t("game.metadataFallback", { name: game.name }),
    path: `/games/${game.slug}`,
  });

  // Thin pages stay reachable and pass link signals, but stay out of search results.
  return isIndexableGame(game)
    ? metadata
    : { ...metadata, robots: { index: false, follow: true } };
}

export default async function GamePage({
  params,
}: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  const sessionUserId = await getSessionUserId();
  const [game, locale] = await Promise.all([
    getGameBySlug(slug, sessionUserId),
    getRequestLocale(),
  ]);

  if (!game) {
    notFound();
  }

  return (
    <GameMemoryCard game={game} locale={locale} sessionUserId={sessionUserId}
      advertisement={<AdSenseBanner key={slug} placement="game" locale={locale} />} />
  );
}

import { notFound } from "next/navigation";
import { GameMemoryCard } from "./_components/game-memory-card";
import { getGameBySlug } from "@/lib/catalog";
import { createTranslator } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";

export async function generateMetadata({
  params,
}: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  const [game, locale] = await Promise.all([getGameBySlug(slug), getRequestLocale()]);
  const t = createTranslator(locale);

  if (!game) {
    return {
      title: t("game.notFound"),
    };
  }

  return {
    title: `${game.name} | filazo`,
    description:
      game.summary ??
      t("game.metadataFallback", { name: game.name }),
  };
}

export default async function GamePage({
  params,
}: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  const [game, locale, sessionUserId] = await Promise.all([
    getGameBySlug(slug),
    getRequestLocale(),
    getSessionUserId(),
  ]);

  if (!game) {
    notFound();
  }

  return (
    <GameMemoryCard game={game} locale={locale} sessionUserId={sessionUserId} />
  );
}

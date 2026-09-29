import type { Prisma } from "@prisma/client";
import { GameCard } from "@/components/game-card";
import { SectionHeader } from "@/components/ui/section-header";
import { getRelatedGames } from "@/lib/catalog";
import { createTranslator, type Locale } from "@/lib/i18n";

export async function RelatedGames({
  game,
  locale,
}: {
  game: { id: string; genres: Prisma.JsonValue | null };
  locale: Locale;
}) {
  const games = await getRelatedGames(game).catch((error: unknown) => {
    // Discovery links are optional; the game page must still render.
    console.error("Could not load related games.", error);
    return [];
  });

  if (!games.length) {
    return null;
  }

  const t = createTranslator(locale);

  return (
    <section className="panel min-w-0 max-sm:p-4">
      <SectionHeader
        eyebrow={t("game.relatedLabel")}
        title={t("game.relatedTitle")}
        description={t("game.relatedHint")}
      />
      <div className="library-grid">
        {games.map((related) => (
          <GameCard game={related} key={related.slug} locale={locale} variant="shelf" />
        ))}
      </div>
    </section>
  );
}

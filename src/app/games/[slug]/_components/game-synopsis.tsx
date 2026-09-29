import { createTranslator, type Locale } from "@/lib/i18n";
import { getTranslatedGameSummary } from "@/lib/game-summary-translation";

export async function GameSynopsis({
  gameId,
  summary,
  locale,
  userId,
}: {
  gameId: string;
  summary: string;
  locale: Locale;
  userId: string | null;
}) {
  const t = createTranslator(locale);
  const translated = await getTranslatedGameSummary({
    gameId,
    summary,
    locale,
    userId,
  }).catch(() => null);

  if (!translated && locale !== "en") {
    // Without a translation, the original text is still the useful thing to
    // read, so show it directly and say which language it is in.
    return (
      <div className="grid gap-3">
        <span className="w-fit rounded-pill border border-edge bg-dusk-lavender-soft px-2.5 py-0.5 text-caption font-bold text-ink">
          {t("game.originalLanguageBadge")}
        </span>
        <p
          className="max-w-[65ch] whitespace-pre-line break-words text-base leading-8 text-ink/90"
          lang="en"
        >
          {summary}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {translated ? (
        <p
          className="max-w-[65ch] whitespace-pre-line break-words text-base leading-8 text-ink/90"
          lang={locale}
        >
          {translated}
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-ink-soft">
          {t("game.translationUnavailable")}
        </p>
      )}
      {locale !== "en" ? (
        <details className="rounded-inner border border-edge bg-canvas/50 p-4">
          <summary className="cursor-pointer rounded text-sm font-semibold text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {t("game.originalSynopsis")}
          </summary>
          <p
            className="mt-3 max-w-[65ch] whitespace-pre-line break-words text-sm leading-7 text-ink-soft"
            lang="en"
          >
            {summary}
          </p>
        </details>
      ) : null}
    </div>
  );
}

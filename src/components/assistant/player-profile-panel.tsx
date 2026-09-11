import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { createTranslator, type Locale } from "@/lib/i18n";
import type { StoredPlayerProfile } from "@/lib/assistant/profile-agent";
import { GameCard, type GameCardGame } from "@/components/game-card";
import { SyncActionForm } from "@/components/sync-action-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getStatusDisplayLabel } from "@/lib/copy";
import { cn, formatDate } from "@/lib/utils";

export function PlayerProfilePanel({
  profile,
  hasGames,
  aiConfigured,
  action,
  locale,
  games,
}: {
  profile: StoredPlayerProfile | null;
  hasGames: boolean;
  aiConfigured: boolean;
  action: (formData: FormData) => void;
  locale: Locale;
  games: GameCardGame[];
}) {
  const t = createTranslator(locale);
  const gamesBySlug = new Map(games.map((game) => [game.slug, game]));
  const payload = profile?.payload;
  const hasProfile = hasGames && profile?.isLocalized;
  const hasGenres = Boolean(payload?.preferredGenres.length);

  // Older saved readings can contain internal status names. Display the same
  // labels used by the catalog, without changing the stored analysis.
  function displayText(text: string) {
    return text.replace(
      /\b(PLAYING_NEXT|PLAYING|BACKLOG|OWNED|WISHLIST|PAUSED|COMPLETED|FINISHED|DROPPED)\b/g,
      (status) => `“${getStatusDisplayLabel(status, locale)}”`,
    );
  }

  return (
    <div className="grid min-w-0 gap-6">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-5 rounded-card border border-edge bg-dusk-lavender-soft px-6 py-5 shadow-rest max-sm:px-4">
        <div className="min-w-0 flex-1 basis-80">
          <p className="section-label !mb-2">{t("playerProfile.label")}</p>
          <h2 className="text-page-title leading-tight">
            {t("playerProfile.title")}
          </h2>
          <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-ink-soft">
            {t("playerProfile.body")}
          </p>
        </div>
        <div className="grid max-w-sm gap-2">
          {hasGames && aiConfigured ? (
            <SyncActionForm
              action={action}
              buttonLabel={
                profile
                  ? t("playerProfile.refresh")
                  : t("playerProfile.generate")
              }
              pendingLabel={t("playerProfile.reading")}
              pendingNotice={t("playerProfile.pending")}
            />
          ) : profile && !aiConfigured ? (
            <p className="text-sm text-ink-soft">
              {t("playerProfile.refreshUnavailable")}
            </p>
          ) : null}
          <p className="text-xs leading-relaxed text-ink-soft">
            {profile
              ? t("playerProfile.generated", {
                  date: formatDate(profile.updatedAt, locale),
                })
              : t("playerProfile.notGenerated")}
          </p>
        </div>
      </header>

      {!hasGames ? (
        <section className="panel grid gap-4 max-sm:p-4">
          <EmptyState title={t("playerProfile.emptyCatalogTitle")}>
            {t("playerProfile.emptyCatalogBody")}
          </EmptyState>
          <Button asChild className="justify-self-start" variant="secondary">
            <Link href="/profile?tab=integrations">
              {t("playerProfile.openSources")}
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        </section>
      ) : profile && !profile.isLocalized ? (
        <section className="panel max-sm:p-4">
          <EmptyState title={t("playerProfile.localeMismatchTitle")}>
            {t("playerProfile.localeMismatchBody")}
          </EmptyState>
        </section>
      ) : !profile && !aiConfigured ? (
        <section className="panel max-sm:p-4">
          <EmptyState title={t("playerProfile.unavailableTitle")}>
            {t("playerProfile.unavailableBody")}
          </EmptyState>
        </section>
      ) : !profile ? (
        <section className="panel max-sm:p-4">
          <EmptyState title={t("playerProfile.notWrittenTitle")}>
            {t("playerProfile.notWrittenBody")}
          </EmptyState>
        </section>
      ) : null}

      {hasProfile && payload ? (
        <>
          <div
            className={cn(
              "grid min-w-0 items-start gap-6",
              hasGenres && "xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]",
            )}
          >
            <section
              className="panel min-w-0 bg-sage-soft/65 max-sm:p-4"
              aria-labelledby="player-profile-summary"
            >
              <h3 className="section-label !mb-4" id="player-profile-summary">
                {t("playerProfile.summaryTitle")}
              </h3>
              <p className="max-w-[65ch] whitespace-pre-line break-words text-pretty font-display text-xl leading-relaxed sm:text-2xl">
                {displayText(payload.summary)}
              </p>
              {payload.playStyles.length ? (
                <div className="mt-6 border-t border-edge pt-5">
                  <h4 className="mb-4 font-display text-lg font-medium">
                    {t("playerProfile.playStyles")}
                  </h4>
                  <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {payload.playStyles.map((style, index) => (
                      <li
                        className="flex min-w-0 items-start gap-3 text-sm leading-relaxed"
                        key={`${style}-${index}`}
                      >
                        <span
                          aria-hidden="true"
                          className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-ink-soft/60"
                        />
                        <span className="min-w-0 break-words">
                          {displayText(style)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
            {hasGenres ? (
              <section
                className="panel min-w-0 max-sm:p-4"
                aria-labelledby="player-profile-genres"
              >
                <h3
                  className="font-display text-xl font-medium"
                  id="player-profile-genres"
                >
                  {t("playerProfile.preferredGenres")}
                </h3>
                <p className="mb-4 mt-2 text-sm leading-relaxed text-ink-soft">
                  {t("playerProfile.genresHint")}
                </p>
                <div className="divide-y divide-edge border-y border-edge">
                  {payload.preferredGenres.map((item, index) => (
                    <details className="group" key={`${item.genre}-${index}`}>
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded py-3 text-base font-semibold transition-colors hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0 break-words">
                          {item.genre}
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className="h-4 w-4 flex-none text-ink-soft motion-safe:transition-transform group-open:rotate-180"
                        />
                      </summary>
                      <p className="max-w-[65ch] break-words pb-4 text-sm leading-relaxed text-ink-soft">
                        {displayText(item.evidence)}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          {payload.behaviorPatterns.length ? (
            <section
              className="panel min-w-0 max-sm:p-4"
              aria-labelledby="player-profile-patterns"
            >
              <h3
                className="font-display text-2xl font-medium"
                id="player-profile-patterns"
              >
                {t("playerProfile.habitsTitle")}
              </h3>
              <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-ink-soft">
                {t("playerProfile.habitsHint")}
              </p>
              <ul className="mt-5 grid gap-x-8 gap-y-4 lg:grid-cols-2">
                {payload.behaviorPatterns.map((pattern, index) => (
                  <li
                    className="min-w-0 border-t border-edge pt-4 text-sm leading-7"
                    key={`${pattern}-${index}`}
                  >
                    <p className="max-w-[65ch] break-words">
                      {displayText(pattern)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {payload.recommendations.length ? (
            <section
              className="panel min-w-0 max-sm:p-4"
              aria-labelledby="player-profile-games"
            >
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="section-label !mb-2">
                    {t("playerProfile.fromCatalog")}
                  </p>
                  <h3
                    className="font-display text-2xl font-medium"
                    id="player-profile-games"
                  >
                    {t("playerProfile.gamesTitle")}
                  </h3>
                  <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-ink-soft">
                    {t("playerProfile.gamesHint")}
                  </p>
                </div>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/profile?tab=assistant">
                    {t("playerProfile.openGuide")}
                    <ChevronRight aria-hidden="true" />
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] items-start gap-4">
                {payload.recommendations.map((recommendation) => (
                  <GameCard
                    key={recommendation.slug}
                    game={
                      gamesBySlug.get(recommendation.slug) ?? {
                        name: recommendation.title,
                        slug: recommendation.slug,
                      }
                    }
                    locale={locale}
                    variant="shelf"
                    footer={
                      <p className="border-t border-edge pt-3 text-sm leading-relaxed text-ink-soft">
                        {displayText(recommendation.reason)}
                      </p>
                    }
                  />
                ))}
              </div>
            </section>
          ) : null}

          {payload.dataNotes.length || profile.toolTrace.length ? (
            <details className="group rounded-card border border-edge bg-surface/70 px-6 py-4 max-sm:px-4">
              <summary className="flex min-h-7 cursor-pointer list-none items-center justify-between gap-3 rounded text-sm font-semibold text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                {t("playerProfile.aboutTitle")}
                <ChevronDown
                  aria-hidden="true"
                  className="h-4 w-4 flex-none motion-safe:transition-transform group-open:rotate-180"
                />
              </summary>
              {payload.dataNotes.length ? (
                <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-ink-soft">
                  {payload.dataNotes.map((note, index) => (
                    <li
                      className="max-w-[65ch] break-words"
                      key={`${note}-${index}`}
                    >
                      {displayText(note)}
                    </li>
                  ))}
                </ul>
              ) : null}
              {profile.toolTrace.length ? (
                <details className="mt-4 border-t border-edge pt-4 text-xs text-ink-soft">
                  <summary className="cursor-pointer rounded font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {t("playerProfile.traceTitle", {
                      count: profile.toolTrace.length,
                    })}
                  </summary>
                  <ol className="mt-3 grid gap-2">
                    {profile.toolTrace.map((step, index) => (
                      <li
                        className="break-words leading-relaxed"
                        key={`${step.tool}-${index}`}
                      >
                        {index + 1}. <code>{step.tool}</code>
                        {step.resultSummary ? ` — ${step.resultSummary}` : ""}
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

import type { AssistantProfileData } from "@/lib/assistant/queries";
import { GameFrictionCard } from "@/components/assistant/game-friction-card";
import { GuideGameCard } from "@/components/assistant/guide-game-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { createTranslator, type Locale } from "@/lib/i18n";

type PlayNextRecommendation =
  NonNullable<AssistantProfileData>["playNextRecommendations"][number];

function RecommendationCard({
  locale,
  recommendation,
}: {
  locale: Locale;
  recommendation: PlayNextRecommendation;
}) {
  const t = createTranslator(locale);
  return (
    <GuideGameCard
      description={recommendation.reason}
      eyebrow={t("assistant.playNext.suggested")}
      game={recommendation.entry.game}
      isPhysicalCopy={recommendation.entry.isPhysicalCopy}
      locale={locale}
      platformName={recommendation.entry.platformName}
      playtimeMinutes={recommendation.entry.playtimeMinutes}
      status={recommendation.entry.status}
    />
  );
}

export function PlayNextPanel({
  assistant,
  locale,
}: {
  assistant: NonNullable<AssistantProfileData>;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const playNext = assistant.playNextRecommendations;
  const playNextEntryIds = new Set(
    playNext.map((recommendation) => recommendation.entryId),
  );
  const releaseCandidates = assistant.insights
    .filter(
      (insight) =>
        insight.signalType === "RELEASE_CANDIDATE" &&
        !playNextEntryIds.has(insight.userGameEntryId),
    )
    .slice(0, 3);

  return (
    <section className="grid min-w-0 items-start gap-6 min-[1440px]:grid-cols-2">
      <article className="panel min-w-0 max-sm:p-4">
        <SectionHeader
          eyebrow={t("assistant.playNext.eyebrow")}
          title={t("assistant.playNext.title")}
        />
        {playNext.length ? (
          <div className="grid gap-3">
            {playNext.map((recommendation) => (
              <RecommendationCard
                key={recommendation.entryId}
                locale={locale}
                recommendation={recommendation}
              />
            ))}
          </div>
        ) : (
          <EmptyState title={t("assistant.playNext.emptyTitle")}>
            {t("assistant.playNext.emptyBody")}
          </EmptyState>
        )}
      </article>

      <article className="panel min-w-0 max-sm:p-4">
        <SectionHeader
          eyebrow={t("assistant.release.eyebrow")}
          title={t("assistant.release.title")}
        />
        {releaseCandidates.length ? (
          <div className="grid gap-3">
            {releaseCandidates.map((insight) => (
              <GameFrictionCard
                insight={insight}
                key={insight.id}
                locale={locale}
              />
            ))}
          </div>
        ) : (
          <EmptyState title={t("assistant.release.emptyTitle")}>
            {t("assistant.release.emptyBody")}
          </EmptyState>
        )}
      </article>
    </section>
  );
}

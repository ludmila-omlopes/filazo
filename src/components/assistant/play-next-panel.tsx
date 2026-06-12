import type { AssistantProfileData } from "@/lib/assistant/queries";
import { GameFrictionCard } from "@/components/assistant/game-friction-card";
import { GameCard } from "@/components/game-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";

type PlayNextRecommendation =
  NonNullable<AssistantProfileData>["playNextRecommendations"][number];

function RecommendationCard({
  recommendation,
}: {
  recommendation: PlayNextRecommendation;
}) {
  const sourceLabel =
    recommendation.source === "openai" ? "AI pick" : "Rule-based pick";
  const genres = [
    recommendation.primaryGenre,
    recommendation.expectedEffort,
    recommendation.moodFit,
  ].filter((item): item is string => Boolean(item));

  return (
    <GameCard
      chips={genres}
      completionPercent={recommendation.entry.completionPercent}
      description={recommendation.reason}
      eyebrow={sourceLabel}
      game={recommendation.entry.game}
      platformName={recommendation.entry.platformName}
      playtimeMinutes={recommendation.entry.playtimeMinutes}
      status={
        recommendation.entry.finishedAt &&
        recommendation.entry.status !== "COMPLETED"
          ? "FINISHED"
          : recommendation.entry.status
      }
      variant="slot"
    />
  );
}

export function PlayNextPanel({
  assistant,
}: {
  assistant: NonNullable<AssistantProfileData>;
}) {
  const playNext = assistant.playNextRecommendations;
  const releaseCandidates = assistant.insights
    .filter((insight) => insight.signalType === "RELEASE_CANDIDATE")
    .slice(0, 3);

  return (
    <section className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
      <article className="panel">
        <SectionHeader
          eyebrow="Play next"
          title="Three easy picks for tonight"
        />
        {playNext.length ? (
          <div className="grid gap-3">
            {playNext.map((recommendation) => (
              <RecommendationCard
                key={recommendation.entryId}
                recommendation={recommendation}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No picks yet.">
            Refresh the assistant to generate play-next suggestions.
          </EmptyState>
        )}
      </article>

      <article className="panel">
        <SectionHeader
          eyebrow="Ready to let go"
          title="Games you can release, guilt-free"
        />
        {releaseCandidates.length ? (
          <div className="grid gap-3">
            {releaseCandidates.map((insight) => (
              <GameFrictionCard insight={insight} key={insight.id} />
            ))}
          </div>
        ) : (
          <EmptyState title="Nothing to release right now.">
            When a game has clearly run its course, it will show up here.
          </EmptyState>
        )}
      </article>
    </section>
  );
}

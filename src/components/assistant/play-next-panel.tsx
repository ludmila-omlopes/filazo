import Link from "next/link";
import type { AssistantProfileData } from "@/lib/assistant/queries";
import { GameFrictionCard } from "@/components/assistant/game-friction-card";
import { Chip } from "@/components/ui/chip";
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
  ].filter(Boolean);

  return (
    <Link
      className="block rounded-card border border-edge bg-paper p-4 shadow-hard-xs transition-all hover:-translate-y-0.5 hover:shadow-hard-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-soft"
      href={`/games/${recommendation.slug}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-label !mb-1">{sourceLabel}</p>
          <h3 className="truncate font-display text-lg">
            {recommendation.title}
          </h3>
        </div>
      </div>
      {genres.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {genres.map((genre) => (
            <Chip key={genre} tone="blue">
              {genre}
            </Chip>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        {recommendation.reason}
      </p>
    </Link>
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

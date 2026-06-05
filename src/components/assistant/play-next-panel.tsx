import Link from "next/link";
import type { AssistantProfileData } from "@/lib/assistant/queries";
import { GameFrictionCard } from "@/components/assistant/game-friction-card";

type PlayNextRecommendation =
  NonNullable<AssistantProfileData>["playNextRecommendations"][number];

function RecommendationCard({
  recommendation,
}: {
  recommendation: PlayNextRecommendation;
}) {
  const sourceLabel =
    recommendation.source === "openai" ? "OpenAI pick" : "Rule fallback";
  const genres = [
    recommendation.primaryGenre,
    recommendation.expectedEffort,
    recommendation.moodFit,
  ].filter(Boolean);

  return (
    <Link
      className="block rounded-[22px] border-3 border-ink bg-paper/95 p-4 shadow-hard-xs transition-all hover:-translate-y-0.5 hover:bg-yellow/15 hover:shadow-hard-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
      href={`/games/${recommendation.slug}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-label !mb-1">{sourceLabel}</p>
          <h3 className="truncate text-lg font-black">
            {recommendation.title}
          </h3>
        </div>
      </div>
      {genres.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {genres.map((genre) => (
            <span
              className="rounded-full border-2 border-ink bg-cyan/30 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-wide"
              key={genre}
            >
              {genre}
            </span>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-sm leading-relaxed text-ink/75">
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
        <div className="mb-[22px]">
          <span className="section-label">Play next</span>
          <h2 className="text-[clamp(1.5rem,3vw,2.2rem)] leading-[1.05]">
            Three low-friction picks
          </h2>
        </div>
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
          <p className="rounded-[22px] border-3 border-ink bg-paper/95 p-5 font-bold">
            Refresh the assistant to generate play-next picks.
          </p>
        )}
      </article>

      <article className="panel">
        <div className="mb-[22px]">
          <span className="section-label">Ready to release</span>
          <h2 className="text-[clamp(1.5rem,3vw,2.2rem)] leading-[1.05]">
            Clear active backlog space
          </h2>
        </div>
        {releaseCandidates.length ? (
          <div className="grid gap-3">
            {releaseCandidates.map((insight) => (
              <GameFrictionCard insight={insight} key={insight.id} />
            ))}
          </div>
        ) : (
          <p className="rounded-[22px] border-3 border-ink bg-paper/95 p-5 font-bold">
            No strong release candidates yet.
          </p>
        )}
      </article>
    </section>
  );
}

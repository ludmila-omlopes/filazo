import Link from "next/link";
import type { AssistantProfileData } from "@/lib/assistant/queries";
import { Chip } from "@/components/ui/chip";
import { estimateRemainingTime } from "@/lib/time-estimates";
import { formatRemainingTime } from "@/lib/utils";

type Insight = AssistantProfileData["insights"][number];

function readReasons(reasons: Insight["reasons"]) {
  return Array.isArray(reasons)
    ? reasons
        .map((reason) =>
          reason && typeof reason === "object" && "evidence" in reason
            ? String(reason.evidence)
            : "",
        )
        .filter(Boolean)
    : [];
}

function readGenres(genres: Insight["userGameEntry"]["game"]["genres"]) {
  if (!genres) {
    return [];
  }

  if (typeof genres === "string") {
    try {
      return readGenres(JSON.parse(genres));
    } catch {
      return [genres];
    }
  }

  if (!Array.isArray(genres)) {
    return [];
  }

  return genres
    .map((genre) => {
      if (typeof genre === "string") {
        return genre;
      }
      if (genre && typeof genre === "object" && "name" in genre) {
        return String((genre as { name?: unknown }).name ?? "");
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 4);
}

export function GameFrictionCard({ insight }: { insight: Insight }) {
  const reasons = readReasons(insight.reasons);
  const genres = readGenres(insight.userGameEntry.game.genres);
  const remainingTime = estimateRemainingTime(insight.userGameEntry);

  return (
    <Link
      className="block rounded-card border border-edge bg-paper p-4 shadow-hard-xs transition-all hover:-translate-y-0.5 hover:shadow-hard-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-soft"
      href={`/profile?tab=games&view=list#entry-${insight.userGameEntry.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-label !mb-1">
            {insight.signalType.replaceAll("_", " ").toLowerCase()}
          </p>
          <h3 className="truncate font-display text-lg">
            {insight.userGameEntry.game.name}
          </h3>
        </div>
        <div className="pill">{insight.score}</div>
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
      {remainingTime ? (
        <p
          className="mt-3 inline-flex rounded-full bg-sage-soft px-2.5 py-0.5 text-xs font-bold"
          title={`Based on HLTB ${remainingTime.targetLabel}`}
        >
          {formatRemainingTime(remainingTime.remainingMinutes)}
        </p>
      ) : null}
      {reasons.length ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {reasons.join(" ")}
        </p>
      ) : null}
      {insight.suggestedAction ? (
        <p className="mt-3 text-sm font-semibold">{insight.suggestedAction}</p>
      ) : null}
    </Link>
  );
}

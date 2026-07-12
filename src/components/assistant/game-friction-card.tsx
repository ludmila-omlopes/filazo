import type { AssistantProfileData } from "@/lib/assistant/queries";
import { GameCard } from "@/components/game-card";
import { getAssistantSignalDisplayLabel } from "@/lib/copy";
import type { Locale } from "@/lib/i18n";

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

export function GameFrictionCard({
  insight,
  locale,
}: {
  insight: Insight;
  locale: Locale;
}) {
  const reasons = readReasons(insight.reasons);
  const genres = readGenres(insight.userGameEntry.game.genres);
  const description = [
    reasons.join(" "),
    insight.suggestedAction,
  ].filter(Boolean).join(" ");

  return (
    <GameCard
      chips={genres}
      completionPercent={insight.userGameEntry.completionPercent}
      description={description}
      eyebrow={getAssistantSignalDisplayLabel(insight.signalType, locale)}
      game={insight.userGameEntry.game}
      isPhysicalCopy={insight.userGameEntry.isPhysicalCopy}
      locale={locale}
      platformName={insight.userGameEntry.platformName}
      playtimeMinutes={insight.userGameEntry.playtimeMinutes}
      status={insight.userGameEntry.status}
      variant="slot"
    />
  );
}

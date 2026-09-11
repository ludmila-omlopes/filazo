import type { AssistantProfileData } from "@/lib/assistant/queries";
import { GuideGameCard } from "@/components/assistant/guide-game-card";
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

export function GameFrictionCard({
  insight,
  locale,
}: {
  insight: Insight;
  locale: Locale;
}) {
  const reasons = readReasons(insight.reasons);
  const description = [
    reasons.join(" "),
    insight.suggestedAction,
  ].filter(Boolean).join(" ");

  return (
    <GuideGameCard
      description={description}
      eyebrow={getAssistantSignalDisplayLabel(insight.signalType, locale)}
      game={insight.userGameEntry.game}
      isPhysicalCopy={insight.userGameEntry.isPhysicalCopy}
      locale={locale}
      platformName={insight.userGameEntry.platformName}
      playtimeMinutes={insight.userGameEntry.playtimeMinutes}
      status={insight.userGameEntry.status}
    />
  );
}

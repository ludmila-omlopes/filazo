import { GameCompletionModel } from "@prisma/client";

type ProviderLinkLike = {
  storyAchievementId?: string | null;
  hasStoryAchievement?: boolean;
};

export type GameCompletionSignals = {
  completionModel?: GameCompletionModel | string | null;
  gameModes?: unknown;
  genres?: unknown;
  hltbMainStoryMinutes?: number | null;
  providerLinks?: ProviderLinkLike[] | null;
};

function readStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      typeof item === "string"
        ? item
        : item && typeof item === "object" && "name" in item
          ? String((item as { name?: unknown }).name ?? "")
          : "",
    )
    .map((item) => item.trim().toLowerCase().replace(/[‐‑‒–—]/g, "-"))
    .filter(Boolean);
}

function isStoredModel(value: unknown): value is GameCompletionModel {
  return Object.values(GameCompletionModel).includes(value as GameCompletionModel);
}

export function inferGameCompletionModel(signals: GameCompletionSignals) {
  const modes = readStringList(signals.gameModes);
  const genres = readStringList(signals.genres);
  const hasStoryMarker = Boolean(
    signals.providerLinks?.some(
      (link) => link.hasStoryAchievement || Boolean(link.storyAchievementId),
    ),
  );
  const hasStoryEstimate = Number(signals.hltbMainStoryMinutes ?? 0) > 0;
  const hasSinglePlayer = modes.some((mode) =>
    ["single player", "single-player", "singleplayer"].includes(mode),
  );
  const hasStrongOngoingMode = modes.some((mode) =>
    ["massively multiplayer online", "mmo", "battle royale", "moba"].includes(mode),
  );
  const hasMultiplayer = modes.some((mode) =>
    ["multiplayer", "co-operative", "co-op", "cooperative", "split screen"].includes(mode),
  );
  const hasOngoingGenre = genres.some((genre) =>
    ["moba", "sports", "sport", "quiz/trivia", "pinball", "card & board game", "arcade"].includes(genre),
  );
  const campaignEvidence =
    hasStoryMarker ||
    hasSinglePlayer ||
    (hasStoryEstimate && !hasStrongOngoingMode && !hasOngoingGenre && !hasMultiplayer);
  const ongoingEvidence = hasStrongOngoingMode || hasOngoingGenre || (hasMultiplayer && !campaignEvidence);

  let model: GameCompletionModel = GameCompletionModel.UNKNOWN;
  if (campaignEvidence && ongoingEvidence) model = GameCompletionModel.HYBRID;
  else if (campaignEvidence) model = GameCompletionModel.CAMPAIGN;
  else if (ongoingEvidence) model = GameCompletionModel.ONGOING;

  return {
    model,
    confidence: model === GameCompletionModel.UNKNOWN ? 0 : campaignEvidence && ongoingEvidence ? 70 : 85,
  };
}

export function getEffectiveGameCompletionModel(signals: GameCompletionSignals) {
  if (isStoredModel(signals.completionModel) && signals.completionModel !== GameCompletionModel.UNKNOWN) {
    return signals.completionModel;
  }
  return inferGameCompletionModel(signals).model;
}

export function isOngoingGame(signals: GameCompletionSignals) {
  return getEffectiveGameCompletionModel(signals) === GameCompletionModel.ONGOING;
}

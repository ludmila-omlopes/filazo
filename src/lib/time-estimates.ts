import { UserGameStatus } from "@prisma/client";

type CompletionTarget = {
  key: "mainExtra" | "mainStory" | "completionist";
  label: string;
  minutes: number;
};

export type RemainingTimeEstimate = {
  remainingMinutes: number;
  totalMinutes: number;
  targetLabel: string;
  basis: "completed" | "playtime" | "full-estimate";
};

type EstimateInput = {
  status: UserGameStatus | `${UserGameStatus}`;
  playtimeMinutes?: number | null;
  completionPercent?: number | null;
  finishedAt?: Date | null;
  game: {
    hltbMainStoryMinutes?: number | null;
    hltbMainExtraMinutes?: number | null;
    hltbCompletionistMinutes?: number | null;
  };
};

/**
 * A game is finished when the credits roll: the user marked it COMPLETED or a
 * story-completion achievement set finishedAt. Achievement progress
 * (completionPercent) is intentionally not part of this — 100% of trophies is
 * mastery, not the bar for finishing.
 */
export function isEntryFinished(entry: {
  status: UserGameStatus | `${UserGameStatus}`;
  finishedAt?: Date | null;
}) {
  return entry.status === UserGameStatus.COMPLETED || Boolean(entry.finishedAt);
}

function getDefaultTarget(game: EstimateInput["game"]): CompletionTarget | null {
  if (game.hltbMainExtraMinutes && game.hltbMainExtraMinutes > 0) {
    return {
      key: "mainExtra",
      label: "main + extras",
      minutes: game.hltbMainExtraMinutes,
    };
  }

  if (game.hltbMainStoryMinutes && game.hltbMainStoryMinutes > 0) {
    return {
      key: "mainStory",
      label: "main story",
      minutes: game.hltbMainStoryMinutes,
    };
  }

  if (game.hltbCompletionistMinutes && game.hltbCompletionistMinutes > 0) {
    return {
      key: "completionist",
      label: "completionist",
      minutes: game.hltbCompletionistMinutes,
    };
  }

  return null;
}

export function estimateRemainingTime(
  entry: EstimateInput,
): RemainingTimeEstimate | null {
  const target = getDefaultTarget(entry.game);
  if (!target) {
    return null;
  }

  if (isEntryFinished(entry)) {
    return {
      remainingMinutes: 0,
      totalMinutes: target.minutes,
      targetLabel: target.label,
      basis: "completed",
    };
  }

  const playtimeMinutes = entry.playtimeMinutes ?? 0;
  if (playtimeMinutes > 0) {
    return {
      remainingMinutes: Math.max(0, target.minutes - playtimeMinutes),
      totalMinutes: target.minutes,
      targetLabel: target.label,
      basis: "playtime",
    };
  }

  return {
    remainingMinutes: target.minutes,
    totalMinutes: target.minutes,
    targetLabel: target.label,
    basis: "full-estimate",
  };
}

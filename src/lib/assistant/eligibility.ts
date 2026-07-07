import { AssistantSignalType, UserGameStatus } from "@prisma/client";
import { isEntryFinished } from "../time-estimates.ts";

/**
 * A single source of truth for "can this entry be recommended?".
 * An entry is recommendable when the user has not closed it out:
 * not completed (credits rolled), not dropped, and not manually
 * deactivated from the active backlog. WISHLIST entries stay eligible;
 * callers that need owned-only apply that on top.
 */
export function isEntryRecommendable(entry: {
  status: UserGameStatus | `${UserGameStatus}`;
  finishedAt?: Date | null;
  activeBacklog?: boolean | null;
}) {
  return (
    entry.activeBacklog !== false &&
    entry.status !== UserGameStatus.DROPPED &&
    !isEntryFinished(entry)
  );
}

const PLAY_NEXT_SIGNAL_PRIORITY = [
  AssistantSignalType.FINISH_BEFORE_RELEASE,
  AssistantSignalType.FINISHABLE_SOON,
  AssistantSignalType.STALE_PLAYING,
  AssistantSignalType.SAMPLED_DROPPED,
  AssistantSignalType.UNTOUCHED,
] as const;

type PlayNextInsight = {
  signalType: AssistantSignalType;
  userGameEntryId: string;
  userGameEntry: {
    status: UserGameStatus | `${UserGameStatus}`;
    finishedAt?: Date | null;
    activeBacklog?: boolean | null;
  };
};

/**
 * Picks up to three play-next insights: only recommendable entries,
 * one per signal type in priority order, never the same entry twice.
 * Assumes `insights` is already sorted best-first (score desc).
 */
export function selectPlayNextInsights<T extends PlayNextInsight>(
  insights: T[],
): T[] {
  const bySignal = new Map<AssistantSignalType, T>();
  for (const insight of insights) {
    if (
      !bySignal.has(insight.signalType) &&
      isEntryRecommendable(insight.userGameEntry)
    ) {
      bySignal.set(insight.signalType, insight);
    }
  }

  const selected: T[] = [];
  const seenEntryIds = new Set<string>();
  for (const signal of PLAY_NEXT_SIGNAL_PRIORITY) {
    const insight = bySignal.get(signal);
    if (!insight || seenEntryIds.has(insight.userGameEntryId)) {
      continue;
    }
    seenEntryIds.add(insight.userGameEntryId);
    selected.push(insight);
    if (selected.length === 3) {
      break;
    }
  }

  return selected;
}

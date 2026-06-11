import {
  BacklogFriction,
  AssistantSignalType,
  EntrySource,
  ExternalProvider,
  UserGameStatus,
} from "@prisma/client";
import { estimateRemainingTime, isEntryFinished } from "../time-estimates.ts";

export type AssistantReason = {
  code: string;
  label: string;
  evidence: string;
};

export type AssistantInsight = {
  entryId: string;
  signalType: AssistantSignalType;
  friction: BacklogFriction;
  score: number;
  confidence: number;
  reasons: AssistantReason[];
  suggestedAction: string;
};

export type AssistantGame = {
  id: string;
  slug: string;
  name: string;
  summary?: string | null;
  genres?: unknown;
  platforms?: unknown;
  metadataSource?: ExternalProvider | null;
  aggregatedRating?: number | null;
  hltbMainStoryMinutes?: number | null;
  hltbMainExtraMinutes?: number | null;
  hltbCompletionistMinutes?: number | null;
  providerLinks?: Array<{
    provider: ExternalProvider;
    hasStoreUrl: boolean;
  }>;
};

export type AssistantEntry = {
  id: string;
  status: UserGameStatus;
  source?: EntrySource;
  provider?: ExternalProvider | null;
  playtimeMinutes?: number | null;
  lastPlayedAt?: Date | null;
  completionPercent?: number | null;
  finishedAt?: Date | null;
  isFavorite?: boolean;
  activeBacklog?: boolean;
  createdAt: Date;
  updatedAt?: Date;
  lastSyncedAt?: Date | null;
  platformName?: string | null;
  userIntent?: string | null;
  desiredSessionMin?: number | null;
  game: AssistantGame;
};

export type LibrarySummary = {
  ownedCount: number;
  untouchedCount: number;
  sampledDroppedCount: number;
  topPlayedGenres: string[];
  untouchedGenres: string[];
  averagePlayedMinutes: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function clampScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function daysSince(value: Date | null | undefined, now: Date) {
  if (!value) {
    return null;
  }

  return Math.floor((now.getTime() - value.getTime()) / DAY_MS);
}

function latestDate(...dates: Array<Date | null | undefined>) {
  return dates
    .filter((date): date is Date => Boolean(date))
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
}

export function readStringList(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    try {
      return readStringList(JSON.parse(value));
    } catch {
      return value ? [value] : [];
    }
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (item && typeof item === "object" && "name" in item) {
        return String((item as { name?: unknown }).name ?? "").trim();
      }
      return "";
    })
    .filter(Boolean);
}

function genreOverlap(left: AssistantEntry, right: AssistantEntry) {
  const leftGenres = new Set(readStringList(left.game.genres).map((genre) => genre.toLowerCase()));
  if (!leftGenres.size) {
    return 0;
  }

  return readStringList(right.game.genres).filter((genre) =>
    leftGenres.has(genre.toLowerCase()),
  ).length;
}

function buildReason(code: string, label: string, evidence: string): AssistantReason {
  return { code, label, evidence };
}

function formatRemainingMinutes(minutes: number) {
  if (minutes < 60) {
    return `~${minutes}m remaining`;
  }

  const hours = minutes / 60;
  return `~${hours < 10 ? hours.toFixed(1) : Math.round(hours)}h remaining`;
}

function getUntouchedInsight(entry: AssistantEntry, now: Date): AssistantInsight | null {
  const playtime = entry.playtimeMinutes ?? 0;
  const ageDays = daysSince(latestDate(entry.createdAt, entry.lastSyncedAt), now) ?? 0;

  if (
    playtime > 0 ||
    (entry.status !== UserGameStatus.OWNED && entry.status !== UserGameStatus.BACKLOG) ||
    ageDays < 30
  ) {
    return null;
  }

  return {
    entryId: entry.id,
    signalType: AssistantSignalType.UNTOUCHED,
    friction: BacklogFriction.CHOICE_OVERLOAD,
    score: clampScore(55 + Math.min(ageDays, 180) / 4),
    confidence: 78,
    reasons: [
      buildReason(
        "no_playtime",
        "No recorded playtime",
        `${entry.game.name} has not logged playtime yet.`,
      ),
      buildReason(
        "old_entry",
        "It has been waiting",
        `This entry has been in the library for ${ageDays} days.`,
      ),
    ],
    suggestedAction: "Try one 25-minute session, then decide whether it stays active.",
  };
}

function getSampledDroppedInsight(entry: AssistantEntry, now: Date): AssistantInsight | null {
  const playtime = entry.playtimeMinutes ?? 0;
  const lastPlayedDays = daysSince(entry.lastPlayedAt, now);

  if (playtime < 1 || playtime > 120 || lastPlayedDays === null || lastPlayedDays < 30) {
    return null;
  }

  return {
    entryId: entry.id,
    signalType: AssistantSignalType.SAMPLED_DROPPED,
    friction: BacklogFriction.LOW_CONFIDENCE_MATCH,
    score: clampScore(62 + Math.min(lastPlayedDays, 180) / 5),
    confidence: 82,
    reasons: [
      buildReason(
        "short_sample",
        "Briefly sampled",
        `${entry.game.name} has ${playtime} recorded minutes.`,
      ),
      buildReason(
        "stale_sample",
        "The sample is resting",
        `Last played ${lastPlayedDays} days ago.`,
      ),
    ],
    suggestedAction: "Ask what bounced you off before trying again.",
  };
}

function getStalePlayingInsight(entry: AssistantEntry, now: Date): AssistantInsight | null {
  const lastPlayedDays = daysSince(entry.lastPlayedAt, now);

  if (entry.status !== UserGameStatus.PLAYING || lastPlayedDays === null || lastPlayedDays < 14) {
    return null;
  }

  return {
    entryId: entry.id,
    signalType: AssistantSignalType.STALE_PLAYING,
    friction: BacklogFriction.STALE_SESSION,
    score: clampScore(58 + Math.min(lastPlayedDays, 90) / 3),
    confidence: 84,
    reasons: [
      buildReason(
        "playing_paused",
        "In-progress but idle",
        `Marked playing, but last played ${lastPlayedDays} days ago.`,
      ),
    ],
    suggestedAction: "Start with a recap note or a short low-stakes session.",
  };
}

function getFinishableSoonInsight(entry: AssistantEntry): AssistantInsight | null {
  const completion = entry.completionPercent ?? 0;
  const remainingTime = estimateRemainingTime(entry);
  const isShortFinish =
    remainingTime !== null &&
    remainingTime.remainingMinutes > 0 &&
    remainingTime.remainingMinutes <= 360;

  if (isEntryFinished(entry) || (completion < 65 && !isShortFinish)) {
    return null;
  }

  const reasons = [
    completion >= 65
      ? buildReason(
          "completion_near",
          "A short return could be enough",
          `${entry.game.name} has ${completion}% of its achievements unlocked.`,
        )
      : null,
    isShortFinish && remainingTime
      ? buildReason(
          "short_remaining_time",
          "Short remaining path",
          `${entry.game.name} has ${formatRemainingMinutes(
            remainingTime.remainingMinutes,
          )} based on ${remainingTime.targetLabel}.`,
        )
      : null,
  ].filter((reason): reason is AssistantReason => Boolean(reason));

  return {
    entryId: entry.id,
    signalType: AssistantSignalType.FINISHABLE_SOON,
    friction: BacklogFriction.COMPLETION_PRESSURE,
    score: clampScore(
      50 +
        completion / 2 +
        (remainingTime
          ? Math.max(0, 360 - remainingTime.remainingMinutes) / 12
          : 0),
    ),
    confidence: isShortFinish ? 80 : 74,
    reasons,
    suggestedAction: "Try one focused session, then decide whether this still matters to you.",
  };
}

function getLikelyFinishedInsight(entry: AssistantEntry, now: Date): AssistantInsight | null {
  const mainStoryMinutes = entry.game.hltbMainStoryMinutes ?? 0;
  const playtime = entry.playtimeMinutes ?? 0;
  const lastPlayedDays = daysSince(entry.lastPlayedAt, now);

  if (
    isEntryFinished(entry) ||
    mainStoryMinutes <= 0 ||
    playtime < mainStoryMinutes * 0.9 ||
    lastPlayedDays === null ||
    lastPlayedDays < 14
  ) {
    return null;
  }

  return {
    entryId: entry.id,
    signalType: AssistantSignalType.LIKELY_FINISHED,
    friction: BacklogFriction.COMPLETION_PRESSURE,
    score: clampScore(55 + Math.min(playtime / mainStoryMinutes, 2) * 15),
    confidence: 60,
    reasons: [
      buildReason(
        "playtime_past_story",
        "Played past the main story length",
        `${entry.game.name} has ${Math.round(playtime / 60)}h logged against a ~${Math.round(
          mainStoryMinutes / 60,
        )}h main story, and has been idle for ${lastPlayedDays} days.`,
      ),
    ],
    suggestedAction:
      "If the credits already rolled, mark it that way so the shelf reflects what happened.",
  };
}

function getWishlistRiskInsight(entry: AssistantEntry, entries: AssistantEntry[]): AssistantInsight | null {
  if (entry.status !== UserGameStatus.WISHLIST) {
    return null;
  }

  const similarUntouched = entries.filter(
    (candidate) =>
      candidate.id !== entry.id &&
      candidate.status !== UserGameStatus.WISHLIST &&
      (candidate.playtimeMinutes ?? 0) === 0 &&
      genreOverlap(entry, candidate) > 0,
  );

  if (similarUntouched.length < 2) {
    return null;
  }

  return {
    entryId: entry.id,
    signalType: AssistantSignalType.WISHLIST_RISK,
    friction: BacklogFriction.TOO_MANY_SIMILAR_GAMES,
    score: clampScore(60 + similarUntouched.length * 8),
    confidence: 76,
    reasons: [
      buildReason(
        "similar_untouched",
        "Similar games are already on the shelf",
        `${similarUntouched.length} similar owned games have no playtime.`,
      ),
    ],
    suggestedAction: "Keep it as a curiosity until one similar game gets a real try.",
  };
}

function getReleaseCandidateInsight(entry: AssistantEntry, now: Date): AssistantInsight | null {
  if (
    isEntryFinished(entry) ||
    entry.status === UserGameStatus.WISHLIST ||
    entry.isFavorite ||
    entry.activeBacklog === false
  ) {
    return null;
  }

  const playtime = entry.playtimeMinutes ?? 0;
  const ageDays = daysSince(latestDate(entry.createdAt, entry.lastSyncedAt), now) ?? 0;
  const lastPlayedDays = daysSince(entry.lastPlayedAt, now);
  const untouched = playtime === 0 && ageDays >= 90;
  const sampledCold = playtime > 0 && playtime <= 120 && lastPlayedDays !== null && lastPlayedDays >= 90;

  if (!untouched && !sampledCold) {
    return null;
  }

  return {
    entryId: entry.id,
    signalType: AssistantSignalType.RELEASE_CANDIDATE,
    friction: untouched
      ? BacklogFriction.CHOICE_OVERLOAD
      : BacklogFriction.LOW_CONFIDENCE_MATCH,
    score: clampScore(64 + Math.min(ageDays, 365) / 10),
    confidence: entry.isFavorite ? 20 : 70,
    reasons: [
      buildReason(
        untouched ? "resting_on_shelf" : "sample_resting",
        untouched ? "Resting on the shelf" : "Sample is resting",
        untouched
          ? `${entry.game.name} has waited ${ageDays} days without playtime.`
          : `${entry.game.name} has a small sample and has been idle for ${lastPlayedDays} days.`,
      ),
    ],
    suggestedAction: "Release it from the active shelf unless there is a specific reason to keep it close.",
  };
}

export function buildLibrarySummary(entries: AssistantEntry[]): LibrarySummary {
  const ownedEntries = entries.filter((entry) => entry.status !== UserGameStatus.WISHLIST);
  const playedEntries = ownedEntries.filter((entry) => (entry.playtimeMinutes ?? 0) > 0);
  const untouchedEntries = ownedEntries.filter((entry) => (entry.playtimeMinutes ?? 0) === 0);
  const sampledDroppedEntries = ownedEntries.filter((entry) => {
    const playtime = entry.playtimeMinutes ?? 0;
    return playtime > 0 && playtime <= 120;
  });

  const genreCounts = new Map<string, number>();
  for (const entry of playedEntries) {
    for (const genre of readStringList(entry.game.genres)) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }

  const untouchedGenreCounts = new Map<string, number>();
  for (const entry of untouchedEntries) {
    for (const genre of readStringList(entry.game.genres)) {
      untouchedGenreCounts.set(genre, (untouchedGenreCounts.get(genre) ?? 0) + 1);
    }
  }

  return {
    ownedCount: ownedEntries.length,
    untouchedCount: untouchedEntries.length,
    sampledDroppedCount: sampledDroppedEntries.length,
    topPlayedGenres: [...genreCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([genre]) => genre),
    untouchedGenres: [...untouchedGenreCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([genre]) => genre),
    averagePlayedMinutes: playedEntries.length
      ? Math.round(
          playedEntries.reduce(
            (total, entry) => total + (entry.playtimeMinutes ?? 0),
            0,
          ) / playedEntries.length,
        )
      : null,
  };
}

export function scoreBacklogEntries(entries: AssistantEntry[], now = new Date()) {
  const insights: AssistantInsight[] = [];

  for (const entry of entries) {
    if (entry.activeBacklog === false || isEntryFinished(entry)) {
      continue;
    }

    insights.push(
      ...[
        getUntouchedInsight(entry, now),
        getSampledDroppedInsight(entry, now),
        getStalePlayingInsight(entry, now),
        getFinishableSoonInsight(entry),
        getLikelyFinishedInsight(entry, now),
        getWishlistRiskInsight(entry, entries),
        getReleaseCandidateInsight(entry, now),
      ].filter((insight): insight is AssistantInsight => Boolean(insight)),
    );
  }

  return insights.sort((left, right) => right.score - left.score);
}

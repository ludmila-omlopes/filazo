import {
  BacklogFriction,
  AssistantSignalType,
  EntrySource,
  ExternalProvider,
  UserGameStatus,
} from "@prisma/client";
import { estimateRemainingTime, isEntryFinished } from "../time-estimates.ts";
import { normalizeTitle } from "../utils.ts";

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
  igdbId?: number | null;
  summary?: string | null;
  genres?: unknown;
  platforms?: unknown;
  metadataSource?: ExternalProvider | null;
  aggregatedRating?: number | null;
  hltbMainStoryMinutes?: number | null;
  hltbMainExtraMinutes?: number | null;
  hltbCompletionistMinutes?: number | null;
  upcomingReleases?: unknown;
  upcomingReleasesCheckedAt?: Date | null;
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
const RELEASE_SIGNAL_WINDOW_DAYS = 180;
const RELEASE_FINISH_MINUTES_PER_DAY = 45;
const RELEASE_MIN_ACTION_WINDOW_MINUTES = 240;
const TITLE_FAMILY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "complete",
  "definitive",
  "deluxe",
  "edition",
  "editions",
  "game",
  "goty",
  "of",
  "remake",
  "remaster",
  "remastered",
  "the",
  "ultimate",
  "year",
]);

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

type CachedUpcomingRelease = {
  igdbId: number | null;
  title: string;
  releaseDate: string;
  relationType: string;
  parentGameIgdbId: number | null;
  franchiseNames: string[];
  collectionNames: string[];
};

type UpcomingReleaseCache = {
  sourceGameName: string;
  franchiseNames: string[];
  collectionNames: string[];
  releases: CachedUpcomingRelease[];
};

type UpcomingReleaseContext = {
  sourceEntryId: string;
  sourceGameId: string;
  sourceGameName: string;
  release: CachedUpcomingRelease;
  releaseDate: Date;
  daysUntilRelease: number;
  familyKeys: Set<string>;
};

type UpcomingReleaseMatch = {
  context: UpcomingReleaseContext;
  matchType: "direct" | "series";
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readUpcomingReleaseCache(value: unknown): UpcomingReleaseCache | null {
  if (!isObject(value) || !Array.isArray(value.releases)) {
    return null;
  }

  const sourceGame = isObject(value.sourceGame) ? value.sourceGame : null;
  const relationKeys = isObject(value.relationKeys) ? value.relationKeys : null;
  const sourceGameName =
    typeof sourceGame?.name === "string" ? sourceGame.name : null;
  if (!sourceGameName) {
    return null;
  }

  return {
    sourceGameName,
    franchiseNames: readStringArray(relationKeys?.franchiseNames),
    collectionNames: readStringArray(relationKeys?.collectionNames),
    releases: value.releases
      .map((release) => {
        if (!isObject(release)) {
          return null;
        }

        const title = release.title;
        const releaseDate = release.releaseDate;
        const relationType = release.relationType;
        if (
          typeof title !== "string" ||
          typeof releaseDate !== "string" ||
          typeof relationType !== "string"
        ) {
          return null;
        }

        return {
          igdbId: readNumber(release.igdbId),
          title,
          releaseDate,
          relationType,
          parentGameIgdbId: readNumber(release.parentGameIgdbId),
          franchiseNames: readStringArray(release.franchiseNames),
          collectionNames: readStringArray(release.collectionNames),
        } satisfies CachedUpcomingRelease;
      })
      .filter(
        (release): release is CachedUpcomingRelease => release !== null,
      ),
  };
}

function getTitleFamilyKey(value: string) {
  const root = value.split(/[:(]|\s+-\s+/)[0] ?? value;
  const tokens = normalizeTitle(root)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter(
      (token) =>
        !TITLE_FAMILY_STOP_WORDS.has(token) &&
        !/^\d+$/.test(token) &&
        !/^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i.test(token),
    );

  if (tokens.length >= 2) {
    return tokens.slice(0, 2).join(" ");
  }

  if (tokens[0] && tokens[0].length >= 5) {
    return tokens[0];
  }

  return null;
}

function getReleaseFamilyKeys(
  cache: UpcomingReleaseCache,
  release: CachedUpcomingRelease,
) {
  return new Set(
    [
      cache.sourceGameName,
      release.title,
      ...cache.franchiseNames,
      ...cache.collectionNames,
      ...release.franchiseNames,
      ...release.collectionNames,
    ]
      .map(getTitleFamilyKey)
      .filter((key): key is string => Boolean(key)),
  );
}

function buildUpcomingReleaseContexts(
  entries: AssistantEntry[],
  now: Date,
): UpcomingReleaseContext[] {
  const contexts: UpcomingReleaseContext[] = [];

  for (const entry of entries) {
    if (!isEntryFinished(entry)) {
      continue;
    }

    const cache = readUpcomingReleaseCache(entry.game.upcomingReleases);
    if (!cache) {
      continue;
    }

    for (const release of cache.releases) {
      const releaseDate = new Date(release.releaseDate);
      if (!Number.isFinite(releaseDate.getTime())) {
        continue;
      }

      const daysUntilRelease = Math.ceil(
        (releaseDate.getTime() - now.getTime()) / DAY_MS,
      );
      if (
        daysUntilRelease < 0 ||
        daysUntilRelease > RELEASE_SIGNAL_WINDOW_DAYS
      ) {
        continue;
      }

      contexts.push({
        sourceEntryId: entry.id,
        sourceGameId: entry.game.id,
        sourceGameName: cache.sourceGameName,
        release,
        releaseDate,
        daysUntilRelease,
        familyKeys: getReleaseFamilyKeys(cache, release),
      });
    }
  }

  return contexts.sort(
    (left, right) =>
      left.releaseDate.getTime() - right.releaseDate.getTime(),
  );
}

function getBestUpcomingReleaseMatch(
  entry: AssistantEntry,
  contexts: UpcomingReleaseContext[],
): UpcomingReleaseMatch | null {
  const entryIgdbId = entry.game.igdbId ?? null;
  const entryFamilyKey = getTitleFamilyKey(entry.game.name);
  const matches = contexts
    .map((context): UpcomingReleaseMatch | null => {
      if (
        entryIgdbId &&
        (context.release.parentGameIgdbId === entryIgdbId ||
          context.release.igdbId === entryIgdbId)
      ) {
        return { context, matchType: "direct" };
      }

      if (entryFamilyKey && context.familyKeys.has(entryFamilyKey)) {
        return { context, matchType: "series" };
      }

      return null;
    })
    .filter((match): match is UpcomingReleaseMatch => match !== null);

  return matches.sort((left, right) => {
    if (left.matchType !== right.matchType) {
      return left.matchType === "direct" ? -1 : 1;
    }

    return left.context.daysUntilRelease - right.context.daysUntilRelease;
  })[0] ?? null;
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

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getReleaseAwareInsight(
  entry: AssistantEntry,
  contexts: UpcomingReleaseContext[],
): AssistantInsight | null {
  if (
    entry.status === UserGameStatus.WISHLIST ||
    entry.activeBacklog === false
  ) {
    return null;
  }

  const match = getBestUpcomingReleaseMatch(entry, contexts);
  if (!match) {
    return null;
  }

  const { context, matchType } = match;
  const remainingTime = estimateRemainingTime(entry);
  const actionWindowMinutes = Math.max(
    RELEASE_MIN_ACTION_WINDOW_MINUTES,
    context.daysUntilRelease * RELEASE_FINISH_MINUTES_PER_DAY,
  );
  const remainingMinutes = remainingTime?.remainingMinutes ?? null;
  const tooLongForWindow =
    remainingMinutes !== null && remainingMinutes > actionWindowMinutes;
  const shortEnoughForWindow =
    remainingMinutes !== null && remainingMinutes <= actionWindowMinutes;
  const hasStarted = (entry.playtimeMinutes ?? 0) > 0;
  const releaseEvidence = `${context.release.title} is dated ${formatIsoDate(
    context.releaseDate,
  )}, ${context.daysUntilRelease} days from now.`;
  const historyEvidence =
    context.sourceGameId === entry.game.id
      ? `${entry.game.name} has a related upcoming release in the shared catalog.`
      : `You have credits rolled on ${context.sourceGameName}, which looks related to ${entry.game.name}.`;
  const timeEvidence =
    remainingMinutes !== null && remainingTime
      ? `${entry.game.name} has ${formatRemainingMinutes(
          remainingMinutes,
        )} based on ${remainingTime.targetLabel}.`
      : `${entry.game.name} does not have enough time-estimate data yet.`;
  const confidenceBase = matchType === "direct" ? 86 : 70;

  if (tooLongForWindow) {
    return {
      entryId: entry.id,
      signalType: AssistantSignalType.RISKY_TO_START_BEFORE_RELEASE,
      friction: BacklogFriction.TIME_COMMITMENT,
      score: clampScore(
        82 +
          Math.max(0, RELEASE_SIGNAL_WINDOW_DAYS - context.daysUntilRelease) /
            5,
      ),
      confidence: confidenceBase,
      reasons: [
        buildReason("related_release", "New release soon", releaseEvidence),
        buildReason("finished_history", "Finished history", historyEvidence),
        buildReason("too_long", "Long for the window", timeEvidence),
      ],
      suggestedAction:
        "Do not start this for the launch window; keep it for later unless you want it for its own sake.",
    };
  }

  if (shortEnoughForWindow) {
    return {
      entryId: entry.id,
      signalType: AssistantSignalType.FINISH_BEFORE_RELEASE,
      friction: BacklogFriction.COMPLETION_PRESSURE,
      score: clampScore(
        84 +
          Math.max(0, RELEASE_SIGNAL_WINDOW_DAYS - context.daysUntilRelease) /
            6 +
          (entry.status === UserGameStatus.PLAYING ? 8 : 0),
      ),
      confidence: confidenceBase,
      reasons: [
        buildReason("related_release", "New release soon", releaseEvidence),
        buildReason("finished_history", "Finished history", historyEvidence),
        buildReason("finish_window", "Fits the window", timeEvidence),
      ],
      suggestedAction:
        "Make this the related-game pick if you want to arrive warm; it looks short enough to finish before launch.",
    };
  }

  if (!hasStarted && entry.status !== UserGameStatus.PLAYING) {
    return null;
  }

  return {
    entryId: entry.id,
    signalType: AssistantSignalType.UPCOMING_RELEASE_WATCH,
    friction: BacklogFriction.UNKNOWN,
    score: clampScore(
      60 +
        Math.max(0, RELEASE_SIGNAL_WINDOW_DAYS - context.daysUntilRelease) / 8,
    ),
    confidence: Math.max(55, confidenceBase - 15),
    reasons: [
      buildReason("related_release", "New release soon", releaseEvidence),
      buildReason("finished_history", "Finished history", historyEvidence),
      buildReason("missing_time_estimate", "Missing time estimate", timeEvidence),
    ],
    suggestedAction:
      "Keep this nearby only if it already fits the mood; the catalog needs more time data before making a stronger call.",
  };
}

function getReleaseCandidateInsight(entry: AssistantEntry, now: Date): AssistantInsight | null {
  if (
    isEntryFinished(entry) ||
    entry.status === UserGameStatus.WISHLIST ||
    entry.status === UserGameStatus.PLAYING_NEXT ||
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
  const upcomingReleaseContexts = buildUpcomingReleaseContexts(entries, now);

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
        getReleaseAwareInsight(entry, upcomingReleaseContexts),
        getReleaseCandidateInsight(entry, now),
      ].filter((insight): insight is AssistantInsight => Boolean(insight)),
    );
  }

  return insights.sort((left, right) => right.score - left.score);
}

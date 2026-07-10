import assert from "node:assert/strict";
import { test } from "node:test";
import { AssistantSignalType, UserGameStatus } from "@prisma/client";
import { buildFallbackPlayNextRecommendations } from "../src/lib/assistant/ai.ts";
import {
  isEntryRecommendable,
  selectPlayNextInsights,
} from "../src/lib/assistant/eligibility.ts";

test("isEntryRecommendable accepts active open library states", () => {
  for (const status of [
    UserGameStatus.OWNED,
    UserGameStatus.BACKLOG,
    UserGameStatus.PLAYING,
    UserGameStatus.WISHLIST,
  ]) {
    assert.equal(isEntryRecommendable(createEntry({ status })), true);
  }
});

test("isEntryRecommendable rejects closed or deactivated entries", () => {
  assert.equal(
    isEntryRecommendable(createEntry({ status: UserGameStatus.COMPLETED })),
    false,
  );
  assert.equal(
    isEntryRecommendable(createEntry({ status: UserGameStatus.DROPPED })),
    false,
  );
  assert.equal(
    isEntryRecommendable(createEntry({ finishedAt: new Date("2026-01-01") })),
    false,
  );
  assert.equal(isEntryRecommendable(createEntry({ activeBacklog: false })), false);
});

test("selectPlayNextInsights skips completed dropped and deactivated entries", () => {
  const selected = selectPlayNextInsights([
    createInsight({
      signalType: AssistantSignalType.FINISH_BEFORE_RELEASE,
      entry: createEntry({ status: UserGameStatus.COMPLETED }),
    }),
    createInsight({
      signalType: AssistantSignalType.FINISHABLE_SOON,
      entry: createEntry({ status: UserGameStatus.DROPPED }),
    }),
    createInsight({
      signalType: AssistantSignalType.STALE_PLAYING,
      entry: createEntry({ activeBacklog: false }),
    }),
    createInsight({
      signalType: AssistantSignalType.UNTOUCHED,
      entryId: "open-entry",
      entry: createEntry({ status: UserGameStatus.OWNED }),
    }),
  ]);

  assert.deepEqual(selected.map((insight) => insight.userGameEntryId), [
    "open-entry",
  ]);
});

test("selectPlayNextInsights never returns the same entry twice", () => {
  const selected = selectPlayNextInsights([
    createInsight({
      signalType: AssistantSignalType.FINISHABLE_SOON,
      entryId: "same-entry",
    }),
    createInsight({
      signalType: AssistantSignalType.STALE_PLAYING,
      entryId: "same-entry",
    }),
    createInsight({
      signalType: AssistantSignalType.UNTOUCHED,
      entryId: "other-entry",
    }),
  ]);

  assert.deepEqual(selected.map((insight) => insight.userGameEntryId), [
    "same-entry",
    "other-entry",
  ]);
});

test("selectPlayNextInsights returns at most three in signal priority order", () => {
  const selected = selectPlayNextInsights([
    createInsight({
      signalType: AssistantSignalType.UNTOUCHED,
      entryId: "untouched",
    }),
    createInsight({
      signalType: AssistantSignalType.SAMPLED_DROPPED,
      entryId: "sampled",
    }),
    createInsight({
      signalType: AssistantSignalType.STALE_PLAYING,
      entryId: "stale",
    }),
    createInsight({
      signalType: AssistantSignalType.FINISHABLE_SOON,
      entryId: "finishable",
    }),
    createInsight({
      signalType: AssistantSignalType.FINISH_BEFORE_RELEASE,
      entryId: "release",
    }),
  ]);

  assert.deepEqual(selected.map((insight) => insight.userGameEntryId), [
    "release",
    "finishable",
    "stale",
  ]);
});

test("fallback play-next recommendations exclude dropped legacy entries", () => {
  const entries = [
    createAssistantEntry({ name: "Dropped", status: UserGameStatus.DROPPED }),
    createAssistantEntry({ name: "Open One", genres: ["Puzzle"] }),
    createAssistantEntry({ name: "Open Two", genres: ["Action"] }),
    createAssistantEntry({ name: "Open Three", genres: ["RPG"] }),
  ];
  const recommendations = buildFallbackPlayNextRecommendations({
    userLibrarySummary: {
      ownedCount: entries.length,
      untouchedCount: entries.length - 1,
      sampledDroppedCount: 0,
      topPlayedGenres: [],
      untouchedGenres: ["Puzzle", "Action", "RPG"],
      averagePlayedMinutes: null,
    },
    entries,
    ruleInsights: [],
  });

  assert.equal(recommendations.length, 3);
  assert.ok(!recommendations.some((item) => item.entryId === "dropped"));
});

function createEntry({
  status = UserGameStatus.OWNED,
  finishedAt = null,
  activeBacklog = true,
} = {}) {
  return {
    status,
    finishedAt,
    activeBacklog,
  };
}

function createInsight({
  signalType,
  entryId = "entry",
  entry = createEntry(),
}) {
  return {
    signalType,
    userGameEntryId: entryId,
    userGameEntry: entry,
  };
}

function createAssistantEntry({
  name,
  status = UserGameStatus.OWNED,
  genres = [],
}) {
  return {
    id: name.toLowerCase().replaceAll(" ", "-"),
    status,
    source: "MANUAL",
    provider: null,
    playtimeMinutes: 0,
    lastPlayedAt: null,
    completionPercent: null,
    finishedAt: null,
    isFavorite: false,
    activeBacklog: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    lastSyncedAt: null,
    platformName: null,
    userIntent: null,
    desiredSessionMin: null,
    game: {
      id: `${name}-game`,
      slug: name.toLowerCase().replaceAll(" ", "-"),
      name,
      igdbId: null,
      summary: null,
      genres,
      platforms: [],
      metadataSource: null,
      aggregatedRating: null,
      hltbMainStoryMinutes: null,
      hltbMainExtraMinutes: null,
      hltbCompletionistMinutes: null,
      upcomingReleases: null,
      upcomingReleasesCheckedAt: null,
      providerLinks: [],
    },
  };
}

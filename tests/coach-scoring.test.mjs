import assert from "node:assert/strict";
import { test } from "node:test";
import { AssistantSignalType, UserGameStatus } from "@prisma/client";
import { buildFallbackPlayNextRecommendations } from "../src/lib/assistant/ai.ts";
import { decideBuy } from "../src/lib/assistant/buy-decision.ts";
import { scoreBacklogEntries } from "../src/lib/assistant/scoring.ts";

const now = new Date("2026-05-25T00:00:00.000Z");

test("untouched owned game older than 30 days is flagged", () => {
  const insights = scoreBacklogEntries([
    createEntry({ name: "Old Zero", createdAt: "2026-03-01", playtimeMinutes: 0 }),
  ], now);

  assert.equal(insights[0]?.signalType, AssistantSignalType.UNTOUCHED);
});

test("short sample not played in 60 days is sampled-dropped", () => {
  const insights = scoreBacklogEntries([
    createEntry({
      name: "Short Sample",
      createdAt: "2026-01-01",
      playtimeMinutes: 45,
      lastPlayedAt: "2026-03-20",
    }),
  ], now);

  assert.ok(
    insights.some((insight) => insight.signalType === AssistantSignalType.SAMPLED_DROPPED),
  );
});

test("stale playing game is flagged after two idle weeks", () => {
  const insights = scoreBacklogEntries([
    createEntry({
      name: "Paused Campaign",
      status: UserGameStatus.PLAYING,
      createdAt: "2026-01-01",
      playtimeMinutes: 600,
      lastPlayedAt: "2026-05-01",
    }),
  ], now);

  assert.ok(
    insights.some((insight) => insight.signalType === AssistantSignalType.STALE_PLAYING),
  );
});

test("favorite games are not release candidates", () => {
  const insights = scoreBacklogEntries([
    createEntry({
      name: "Favorite Old Game",
      createdAt: "2025-01-01",
      playtimeMinutes: 0,
      isFavorite: true,
    }),
  ], now);

  assert.ok(
    !insights.some((insight) => insight.signalType === AssistantSignalType.RELEASE_CANDIDATE),
  );
});

test("completed games are excluded from active backlog recommendations", () => {
  const insights = scoreBacklogEntries([
    createEntry({
      name: "Done",
      status: UserGameStatus.COMPLETED,
      createdAt: "2025-01-01",
      playtimeMinutes: 0,
      completionPercent: 100,
    }),
  ], now);

  assert.equal(insights.length, 0);
});

test("short HLTB remaining time can make a game finishable soon", () => {
  const insights = scoreBacklogEntries([
    createEntry({
      name: "Almost Short",
      playtimeMinutes: 600,
      hltbMainExtraMinutes: 840,
    }),
  ], now);

  assert.ok(
    insights.some((insight) => insight.signalType === AssistantSignalType.FINISHABLE_SOON),
  );
});

test("finished history can make a related short game worth finishing before release", () => {
  const insights = scoreBacklogEntries([
    createEntry({
      name: "Hollow Knight",
      status: UserGameStatus.COMPLETED,
      igdbId: 1,
      upcomingReleases: createReleaseCache({
        releaseDate: "2026-07-01",
        releaseTitle: "Hollow Knight: Silksong",
        sourceIgdbId: 1,
        sourceName: "Hollow Knight",
      }),
    }),
    createEntry({
      name: "Hollow Knight: Voidheart Edition",
      status: UserGameStatus.BACKLOG,
      igdbId: 2,
      playtimeMinutes: 300,
      hltbMainStoryMinutes: 600,
    }),
  ], now);

  assert.ok(
    insights.some((insight) => insight.signalType === AssistantSignalType.FINISH_BEFORE_RELEASE),
  );
});

test("long related games are marked as risky starts near an upcoming release", () => {
  const insights = scoreBacklogEntries([
    createEntry({
      name: "Dark Souls",
      status: UserGameStatus.COMPLETED,
      igdbId: 10,
      upcomingReleases: createReleaseCache({
        releaseDate: "2026-06-10",
        releaseTitle: "Dark Souls IV",
        sourceIgdbId: 10,
        sourceName: "Dark Souls",
      }),
    }),
    createEntry({
      name: "Dark Souls II",
      status: UserGameStatus.BACKLOG,
      igdbId: 11,
      playtimeMinutes: 0,
      hltbMainStoryMinutes: 2400,
    }),
  ], now);

  assert.ok(
    insights.some((insight) => insight.signalType === AssistantSignalType.RISKY_TO_START_BEFORE_RELEASE),
  );
});

test("wishlist game similar to untouched owned games gets wishlist risk", () => {
  const insights = scoreBacklogEntries([
    createEntry({ name: "Wanted RPG", status: UserGameStatus.WISHLIST, genres: ["RPG"] }),
    createEntry({ name: "Owned RPG 1", createdAt: "2025-01-01", genres: ["RPG"] }),
    createEntry({ name: "Owned RPG 2", createdAt: "2025-01-01", genres: ["RPG"] }),
  ], now);

  assert.ok(
    insights.some((insight) => insight.signalType === AssistantSignalType.WISHLIST_RISK),
  );
});

test("buy decision skips games already owned", () => {
  const decision = decideBuy(
    { title: "Owned RPG", genres: ["RPG"] },
    [createEntry({ name: "Owned RPG", genres: ["RPG"] })],
  );

  assert.equal(decision.verdict, "SKIP_FOR_NOW");
});

test("buy decision waits for sale when fit is good but similar games are untouched", () => {
  const decision = decideBuy(
    { title: "New RPG", genres: ["RPG"], priceText: "$39.99" },
    [
      createEntry({ name: "Played RPG 1", genres: ["RPG"], playtimeMinutes: 300 }),
      createEntry({ name: "Played RPG 2", genres: ["RPG"], playtimeMinutes: 500 }),
      createEntry({ name: "Untouched RPG 1", genres: ["RPG"], playtimeMinutes: 0 }),
      createEntry({ name: "Untouched RPG 2", genres: ["RPG"], playtimeMinutes: 0 }),
    ],
  );

  assert.equal(decision.verdict, "WAIT_FOR_SALE");
});

test("fallback play-next recommendations prefer different genres when possible", () => {
  const entries = [
    createEntry({ name: "Fast Action", genres: ["Action"], playtimeMinutes: 30 }),
    createEntry({ name: "Long Action", genres: ["Action"], playtimeMinutes: 0 }),
    createEntry({ name: "Cozy Puzzle", genres: ["Puzzle"], playtimeMinutes: 0 }),
    createEntry({ name: "Short RPG", genres: ["RPG"], playtimeMinutes: 0 }),
  ];
  const ruleInsights = scoreBacklogEntries(entries, now);
  const recommendations = buildFallbackPlayNextRecommendations({
    userLibrarySummary: {
      ownedCount: entries.length,
      untouchedCount: 3,
      sampledDroppedCount: 1,
      topPlayedGenres: ["Action"],
      untouchedGenres: ["Action", "Puzzle", "RPG"],
      averagePlayedMinutes: 30,
    },
    entries,
    ruleInsights,
  });

  assert.equal(recommendations.length, 3);
  assert.equal(new Set(recommendations.map((item) => item.primaryGenre)).size, 3);
});

function createEntry({
  name,
  status = UserGameStatus.OWNED,
  createdAt = "2026-01-01",
  playtimeMinutes = 0,
  lastPlayedAt = null,
  completionPercent = null,
  isFavorite = false,
  activeBacklog = true,
  genres = [],
  igdbId = null,
  upcomingReleases = null,
  hltbMainStoryMinutes = null,
  hltbMainExtraMinutes = null,
  hltbCompletionistMinutes = null,
}) {
  return {
    id: name.toLowerCase().replaceAll(" ", "-"),
    status,
    playtimeMinutes,
    lastPlayedAt: lastPlayedAt ? new Date(lastPlayedAt) : null,
    completionPercent,
    isFavorite,
    activeBacklog,
    createdAt: new Date(`${createdAt}T00:00:00.000Z`),
    game: {
      id: `${name}-game`,
      slug: name.toLowerCase().replaceAll(" ", "-"),
      name,
      igdbId,
      genres,
      platforms: [],
      aggregatedRating: null,
      hltbMainStoryMinutes,
      hltbMainExtraMinutes,
      hltbCompletionistMinutes,
      upcomingReleases,
      upcomingReleasesCheckedAt: upcomingReleases ? now : null,
    },
  };
}

function createReleaseCache({
  releaseDate,
  releaseTitle,
  sourceIgdbId,
  sourceName,
}) {
  return {
    version: 1,
    source: "IGDB",
    checkedAt: now.toISOString(),
    horizonDays: 365,
    sourceGame: {
      igdbId: sourceIgdbId,
      name: sourceName,
      slug: null,
      url: null,
    },
    relationKeys: {
      franchiseNames: [],
      collectionNames: [],
    },
    releases: [
      {
        provider: "IGDB",
        providerGameId: String(sourceIgdbId + 100),
        igdbId: sourceIgdbId + 100,
        title: releaseTitle,
        slug: null,
        summary: null,
        releaseDate: new Date(`${releaseDate}T00:00:00.000Z`).toISOString(),
        relationType: "sequel_or_related",
        gameType: null,
        parentGameIgdbId: null,
        url: null,
        franchiseNames: [],
        collectionNames: [],
      },
    ],
  };
}

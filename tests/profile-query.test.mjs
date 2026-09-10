import assert from "node:assert/strict";
import { test } from "node:test";
import { ExternalProvider, GameCompletionModel, UserGameStatus } from "@prisma/client";
import {
  filterEntries,
  getPlatformFilterOptions,
  getUserPlatformLabel,
  UNKNOWN_PLATFORM_FILTER,
} from "../src/app/profile/_components/profile-query.ts";

test("profile catalog shows not-started entries and hides dropped entries by default", () => {
  const entries = [
    createEntry("Played Steam Game", {
      platformName: "Steam",
      playtimeMinutes: 45,
    }),
    createEntry("Not Started Game", {
      platformName: "Switch",
    }),
    createEntry("Dropped Game", {
      status: UserGameStatus.DROPPED,
      activeBacklog: false,
    }),
  ];

  assert.deepEqual(
    filterEntries({
      activePlatform: null,
      activeStatus: null,
      entries,
      includeDormant: false,
      queryText: "",
      signalEntryIds: null,
    }).map((entry) => entry.game.name),
    ["Played Steam Game", "Not Started Game"],
  );

  assert.deepEqual(
    filterEntries({
      activePlatform: null,
      activeStatus: null,
      entries,
      includeDormant: true,
      queryText: "",
      signalEntryIds: null,
    }).map((entry) => entry.game.name),
    ["Played Steam Game", "Not Started Game", "Dropped Game"],
  );
});

test("profile platform filter uses user entry platform/provider context", () => {
  const entries = [
    createEntry("Steam Provider Game", {
      provider: ExternalProvider.STEAM,
      playtimeMinutes: 10,
    }),
    createEntry("Imported PlayStation Game", {
      platformName: "PlayStation",
      playtimeMinutes: 20,
    }),
    createEntry("Unknown Platform Game", {
      playtimeMinutes: 5,
    }),
  ];

  assert.deepEqual(
    filterEntries({
      activePlatform: "Steam",
      activeStatus: null,
      entries,
      includeDormant: false,
      queryText: "",
      signalEntryIds: null,
    }).map((entry) => entry.game.name),
    ["Steam Provider Game"],
  );

  assert.deepEqual(
    filterEntries({
      activePlatform: UNKNOWN_PLATFORM_FILTER,
      activeStatus: null,
      entries,
      includeDormant: false,
      queryText: "",
      signalEntryIds: null,
    }).map((entry) => entry.game.name),
    ["Unknown Platform Game"],
  );
});

test("profile structure filter is opt-in and separates ongoing games", () => {
  const entries = [
    createEntry("Campaign", {
      game: { name: "Campaign", completionModel: GameCompletionModel.CAMPAIGN, hltbMainStoryMinutes: 600 },
    }),
    createEntry("Ongoing", {
      game: { name: "Ongoing", gameModes: ["Multiplayer"] },
    }),
  ];

  assert.equal(
    filterEntries({
      activePlatform: null,
      activeStatus: null,
      activeCompletionModel: null,
      entries,
      includeDormant: false,
      queryText: "",
      signalEntryIds: null,
    }).length,
    2,
  );
  assert.deepEqual(
    filterEntries({
      activePlatform: null,
      activeStatus: null,
      activeCompletionModel: GameCompletionModel.ONGOING,
      entries,
      includeDormant: false,
      queryText: "",
      signalEntryIds: null,
    }).map((entry) => entry.game.name),
    ["Ongoing"],
  );
});

test("profile filter uses new story evidence but preserves manual classification", () => {
  const storyGame = { completionModel: "ONGOING", completionModelSource: "RULES", gameModes: ["Multiplayer"], providerLinks: [{ storyAchievementId: "credits" }] };
  const entries = [
    createEntry("Story found", { game: { name: "Story found", ...storyGame } }),
    createEntry("Manual", { game: { name: "Manual", ...storyGame, completionModelSource: "MANUAL" } }),
  ];
  const options = { activePlatform: null, activeStatus: null, entries, includeDormant: false, queryText: "", signalEntryIds: null };
  assert.deepEqual(filterEntries({ ...options, activeCompletionModel: "CAMPAIGN" }).map((entry) => entry.id), ["Story found"]);
  assert.deepEqual(filterEntries({ ...options, activeCompletionModel: "ONGOING" }).map((entry) => entry.id), ["Manual"]);
});

test("platform filters flatten the duplicated legacy values shown in the shelf", () => {
  const names = [
    "Steam", "PlayStation PS4", "PlayStation", "PlayStation PS5",
    "PlayStation PS5, PlayStation PC, PlayStation PS5",
    "PlayStation PS5, PlayStation PS4, PlayStation PS5, PlayStation PS5",
    "PlayStation PS4, PlayStation PS5, PlayStation PS5, PlayStation PS5",
    "PlayStation PS4, PlayStation PS5, PlayStation PS5", "Win32",
    "PlayStation PS4, PlayStation PS5",
  ];
  const entries = names.map((platformName, index) => createEntry(String(index), { platformName }));
  assert.deepEqual(getPlatformFilterOptions(entries), ["PC", "PlayStation", "PS4", "PS5", "Steam"]);
  const options = { activeStatus: null, activeCompletionModel: null, entries, includeDormant: false, queryText: "", signalEntryIds: null };
  assert.deepEqual(filterEntries({ ...options, activePlatform: "PS5" }).map((entry) => entry.id), ["3", "4", "5", "6", "7", "9"]);
  assert.deepEqual(filterEntries({ ...options, activePlatform: "PlayStation PS4" }).map((entry) => entry.id), ["1", "5", "6", "7", "9"]);
  assert.deepEqual(filterEntries({ ...options, activePlatform: "PC" }).map((entry) => entry.id), ["4", "8"]);
  assert.equal(getUserPlatformLabel(entries[4]), "PS5, PC");
});

test("platform normalization keeps hardware identities and does not infer ownership from catalog availability", () => {
  const entries = [
    createEntry("PC via Xbox", { platformName: "Win32, Windows", provider: ExternalProvider.XBOX }),
    createEntry("Console", { platformName: "XboxOne, XboxSeriesX", provider: ExternalProvider.XBOX }),
    createEntry("Switch", { platformName: "switch", game: { name: "Switch", platforms: ["PS5", "PC"] } }),
    createEntry("Unknown", { platformName: " , ; " }),
  ];
  assert.deepEqual(getPlatformFilterOptions(entries), ["Nintendo Switch", "PC", "Xbox One", "Xbox Series X", UNKNOWN_PLATFORM_FILTER]);
  const options = { activeStatus: null, activeCompletionModel: null, entries, includeDormant: false, queryText: "", signalEntryIds: null };
  assert.deepEqual(filterEntries({ ...options, activePlatform: "PS5" }), []);
  assert.deepEqual(filterEntries({ ...options, activePlatform: UNKNOWN_PLATFORM_FILTER }).map((entry) => entry.id), ["Unknown"]);
  assert.deepEqual(filterEntries({ ...options, activePlatform: null, queryText: "PC" }).map((entry) => entry.id), ["PC via Xbox"]);
});

test("all distinct owned platforms remain available beyond ten options", () => {
  const entries = Array.from({ length: 12 }, (_, index) => createEntry(`Title ${index}`, { platformName: `Console ${index}` }));
  assert.equal(getPlatformFilterOptions(entries).length, 12);
});

function createEntry(name, overrides = {}) {
  return {
    id: name,
    status: UserGameStatus.OWNED,
    provider: null,
    platformName: null,
    activeBacklog: true,
    finishedAt: null,
    startedAt: null,
    lastPlayedAt: null,
    currentPlayingSlot: null,
    playtimeMinutes: 0,
    completionPercent: null,
    game: {
      name,
    },
    ...overrides,
  };
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { ExternalProvider, UserGameStatus } from "@prisma/client";
import {
  filterEntries,
  UNKNOWN_PLATFORM_FILTER,
} from "../src/app/profile/_components/profile-query.ts";

test("profile catalog hides dropped and not-started entries by default", () => {
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
    ["Played Steam Game"],
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

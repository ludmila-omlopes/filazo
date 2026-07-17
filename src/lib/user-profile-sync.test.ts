import assert from "node:assert/strict";
import { test } from "node:test";
import { getUserProfileSyncData } from "./user-profile-sync.ts";

test("keeps the user's existing display name and avatar", () => {
  assert.deepEqual(
    getUserProfileSyncData(
      { displayName: "Ludmila", avatarUrl: "https://example.com/me.png" },
      { displayName: "xX_steam_Xx", avatarUrl: "https://steam/avatar.png" },
    ),
    { displayName: "Ludmila", avatarUrl: "https://example.com/me.png" },
  );
});

test("fills missing fields from the provider profile", () => {
  assert.deepEqual(
    getUserProfileSyncData(
      { displayName: null, avatarUrl: null },
      { displayName: "xX_steam_Xx", avatarUrl: "https://steam/avatar.png" },
    ),
    { displayName: "xX_steam_Xx", avatarUrl: "https://steam/avatar.png" },
  );
});

test("leaves fields untouched when neither side has a value", () => {
  assert.deepEqual(
    getUserProfileSyncData({ displayName: null, avatarUrl: null }, {}),
    { displayName: undefined, avatarUrl: undefined },
  );
});

test("handles a missing user row", () => {
  assert.deepEqual(getUserProfileSyncData(null, { displayName: "Steam" }), {
    displayName: "Steam",
    avatarUrl: undefined,
  });
});

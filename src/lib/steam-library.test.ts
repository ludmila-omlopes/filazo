import assert from "node:assert/strict";
import { test } from "node:test";
import { mapSteamOwnedGames } from "./steam-library.ts";

test("Steam library mapping excludes achievement progress", () => {
  const [game] = mapSteamOwnedGames([
    {
      appid: 123,
      name: "Example Game",
      playtime_forever: 90,
      rtime_last_played: 1_700_000_000,
    },
  ]);

  assert.equal(game?.providerGameId, "123");
  assert.equal(game?.playtimeMinutes, 90);
  assert.equal(game?.lastPlayedAt?.toISOString(), "2023-11-14T22:13:20.000Z");
  assert.equal("completionPercent" in (game ?? {}), false);
  assert.equal("achievementCompletion" in (game?.rawData ?? {}), false);
});

test("Steam library mapping ignores entries without a title", () => {
  assert.deepEqual(mapSteamOwnedGames([{ appid: 456 }]), []);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { mapSteamOwnedGames, mapSteamOwnedGamesResponse } from "./steam-library.ts";

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

test("Steam library mapping preserves entries without a title", () => {
  const [game] = mapSteamOwnedGames([{ appid: 456 }]);
  assert.equal(game.providerGameId, "456");
  assert.equal(game.title, "Steam App 456");
});

test("Steam keeps a large library intact, including unnamed titles", () => {
  const games = Array.from({ length: 1508 }, (_, appid) => ({ appid: appid + 1, name: appid % 10 ? `Game ${appid}` : undefined }));
  const mapped = mapSteamOwnedGamesResponse({ response: { games, game_count: 1508 } });
  assert.equal(mapped.length, 1508);
  assert.equal(new Set(mapped.map(game => game.providerGameId)).size, 1508);
});

test("Steam distinguishes an empty library from private or incomplete responses", () => {
  assert.deepEqual(mapSteamOwnedGamesResponse({ response: { game_count: 0 } }), []);
  assert.throws(() => mapSteamOwnedGamesResponse({ response: {} }), /unavailable/);
  assert.throws(() => mapSteamOwnedGamesResponse({}), /unavailable/);
  assert.throws(() => mapSteamOwnedGamesResponse({ response: { game_count: 2, games: [{ appid: 1 }] } }), /incomplete/);
});

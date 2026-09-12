import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGogVerificationChallenge,
  mapGogPublicGameToSyncedGame,
  normalizeGogUsername,
  parseGogProfileDocument,
  parseGogLibraryPage,
  readGogVerificationChallenge,
} from "./gog.ts";

test("GOG page validation supports libraries beyond 100 pages and rejects incomplete responses", () => {
  const fixture = {
    page: 101, pages: 102, total: 5100,
    _embedded: { items: [{ game: { id: 123, title: "Large library game" } }] },
  };
  assert.equal(parseGogLibraryPage(fixture, 101, "user").nextPage, 102);
  assert.equal(parseGogLibraryPage({ ...fixture, page: 102 }, 102, "user").nextPage, null);
  assert.throws(() => parseGogLibraryPage(fixture, 100, "user"), /pagination/);
  assert.throws(() => parseGogLibraryPage({ ...fixture, _embedded: { items: [] } }, 101, "user"), /incomplete/);
  assert.throws(() => parseGogLibraryPage({ ...fixture, _embedded: { items: [{}] } }, 101, "user"), /invalid library game/);
  assert.deepEqual(parseGogLibraryPage({
    page: 1, pages: 0, total: 0, _embedded: { items: [] },
  }, 1, "user"), { games: [], nextPage: null, totalCount: 0 });
});

test("normalizes GOG usernames and public profile URLs", () => {
  assert.equal(normalizeGogUsername("  Player.Name_10  "), "Player.Name_10");
  assert.equal(
    normalizeGogUsername("https://www.gog.com/en/u/Player.Name_10/"),
    "Player.Name_10",
  );
  assert.throws(
    () => normalizeGogUsername("https://example.com/u/player"),
    /must belong to gog.com/,
  );
  assert.throws(() => normalizeGogUsername("player/name"), /valid GOG username/);
});

test("GOG verification challenges are short-lived and bound to a user", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "a-test-secret-that-is-long-enough";
  const now = new Date("2026-09-11T12:00:00.000Z");

  try {
    const created = await createGogVerificationChallenge({
      now,
      userId: "filazo-user-1",
      username: "gog_player",
    });
    assert.match(created.challenge.code, /^FLZ-[2-9A-HJ-NP-Z]{8}$/);
    assert.equal(created.challenge.username, "gog_player");
    assert.equal(created.maxAge, 15 * 60);
    assert.deepEqual(
      await readGogVerificationChallenge({
        now,
        token: created.token,
        userId: "filazo-user-1",
      }),
      created.challenge,
    );
    assert.equal(
      await readGogVerificationChallenge({
        now,
        token: created.token,
        userId: "another-user",
      }),
      null,
    );
    assert.equal(
      await readGogVerificationChallenge({
        now: new Date("2026-09-11T12:16:00.000Z"),
        token: created.token,
        userId: "filazo-user-1",
      }),
      null,
    );
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});

test("parses GOG public profile data without being confused by bio punctuation", () => {
  const parsed = parseGogProfileDocument(`
    <script>
      window.profilesData.profileUser = {"userId":"12345","username":"gog_player","stats":{"games_owned":7}};
      window.profilesData.profileUserPreferences = {"bio":"FLZ-23456789 {saved}; \\"quoted\\"","privacy":{"profile":"public","games":"public"}};
    </script>
  `);

  assert.equal(parsed.user.userId, "12345");
  assert.equal(parsed.user.username, "gog_player");
  assert.equal(parsed.preferences.bio, 'FLZ-23456789 {saved}; "quoted"');
  assert.deepEqual(parsed.preferences.privacy, {
    games: "public",
    profile: "public",
  });
});

test("maps public GOG games and the connected account's stats", () => {
  assert.deepEqual(
    mapGogPublicGameToSyncedGame(
      {
        game: {
          achievementSupport: true,
          id: "123",
          image: "https://images.gog-statics.com/game.png",
          title: "A Good Old Game",
          url: "/en/game/a_good_old_game",
        },
        stats: {
          "galaxy-user-id": {
            achievementsPercentage: 80,
            lastSession: "2026-09-10T20:30:00.000Z",
            playtime: 125,
          },
        },
      },
      "galaxy-user-id",
    ),
    {
      completionPercent: 80,
      lastPlayedAt: new Date("2026-09-10T20:30:00.000Z"),
      platformName: "GOG",
      playtimeMinutes: 125,
      providerGameId: "123",
      rawData: {
        achievementSupport: true,
        image: "https://images.gog-statics.com/game.png",
        images: {
          background: null,
          logo: "https://images.gog-statics.com/game.png",
          logo2x: "https://images.gog-statics.com/game.png",
        },
        source: "public-profile",
      },
      storeUrl: "https://www.gog.com/en/game/a_good_old_game",
      title: "A Good Old Game",
    },
  );

  assert.equal(
    mapGogPublicGameToSyncedGame({ game: { id: 456, title: "" } }, "user"),
    null,
  );
});

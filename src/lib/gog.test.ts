import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGogAuthUrl,
  mapGogProductToSyncedGame,
  parseGogRedirectUrl,
} from "./gog.ts";

const REDIRECT_URI =
  "https://embed.gog.com/on_login_success?origin=client";

test("GOG browser login URL carries the nonce and registered redirect", () => {
  const previousClientId = process.env.GOG_CLIENT_ID;
  const previousClientSecret = process.env.GOG_CLIENT_SECRET;
  const previousRedirectUri = process.env.GOG_REDIRECT_URI;
  process.env.GOG_CLIENT_ID = "test-client";
  process.env.GOG_CLIENT_SECRET = "test-secret";
  process.env.GOG_REDIRECT_URI = REDIRECT_URI;

  try {
    const url = createGogAuthUrl("fresh-state");
    assert.equal(url.origin, "https://auth.gog.com");
    assert.equal(url.searchParams.get("client_id"), "test-client");
    assert.equal(url.searchParams.get("redirect_uri"), REDIRECT_URI);
    assert.equal(url.searchParams.get("state"), "fresh-state");
    assert.equal(url.searchParams.get("response_type"), "code");
  } finally {
    if (previousClientId === undefined) delete process.env.GOG_CLIENT_ID;
    else process.env.GOG_CLIENT_ID = previousClientId;
    if (previousClientSecret === undefined) delete process.env.GOG_CLIENT_SECRET;
    else process.env.GOG_CLIENT_SECRET = previousClientSecret;
    if (previousRedirectUri === undefined) delete process.env.GOG_REDIRECT_URI;
    else process.env.GOG_REDIRECT_URI = previousRedirectUri;
  }
});

test("GOG browser login accepts only the expected redirect and state", () => {
  assert.equal(
    parseGogRedirectUrl(
      `${REDIRECT_URI}&code=one-time-code&state=expected-state`,
      "expected-state",
      REDIRECT_URI,
    ),
    "one-time-code",
  );

  assert.throws(
    () =>
      parseGogRedirectUrl(
        `${REDIRECT_URI}&code=one-time-code&state=wrong-state`,
        "expected-state",
        REDIRECT_URI,
      ),
    /state could not be verified/,
  );
  assert.throws(
    () =>
      parseGogRedirectUrl(
        "https://example.com/on_login_success?code=one-time-code&state=expected-state",
        "expected-state",
        REDIRECT_URI,
      ),
    /was not returned by GOG/,
  );
});

test("GOG product mapping keeps games and excludes explicit non-games", () => {
  assert.deepEqual(
    mapGogProductToSyncedGame({
      id: 123,
      title: "A Good Old Game",
      slug: "a_good_old_game",
      game_type: "game",
      images: {
        background: "//images.gog.com/background.jpg",
        logo2x: "//images.gog.com/logo.jpg",
      },
    }),
    {
      providerGameId: "123",
      title: "A Good Old Game",
      platformName: "GOG",
      storeUrl: "https://www.gog.com/game/a_good_old_game",
      rawData: {
        gameType: "game",
        image: null,
        images: {
          background: "https://images.gog.com/background.jpg",
          logo: null,
          logo2x: "https://images.gog.com/logo.jpg",
        },
        slug: "a_good_old_game",
        worksOn: undefined,
      },
    },
  );

  assert.equal(
    mapGogProductToSyncedGame({
      id: 456,
      title: "Soundtrack",
      game_type: "dlc",
    }),
    null,
  );
  assert.equal(
    mapGogProductToSyncedGame({
      id: 789,
      title: "A Movie",
      isMovie: true,
    }),
    null,
  );
});

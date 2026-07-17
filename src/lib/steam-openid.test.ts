import assert from "node:assert/strict";
import { test } from "node:test";
import { createSteamAuthUrl } from "./steam-openid.ts";

test("builds a checkid_setup request against Steam's endpoint", () => {
  const url = new URL(createSteamAuthUrl("https://app.example"));
  assert.equal(url.origin, "https://steamcommunity.com");
  assert.equal(url.searchParams.get("openid.mode"), "checkid_setup");
  assert.equal(url.searchParams.get("openid.realm"), "https://app.example");
  assert.equal(
    url.searchParams.get("openid.return_to"),
    "https://app.example/api/auth/steam/callback",
  );
});

test("threads the state nonce through return_to", () => {
  const url = new URL(createSteamAuthUrl("https://app.example", "abc123"));
  const returnTo = new URL(url.searchParams.get("openid.return_to")!);
  assert.equal(returnTo.pathname, "/api/auth/steam/callback");
  assert.equal(returnTo.searchParams.get("state"), "abc123");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { createSteamAuthUrl, verifySteamOpenIdCallback } from "./steam-openid.ts";

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

const ORIGIN = "https://app.example";
const STATE = "abc123";
const NOW = new Date("2026-10-03T12:00:00Z");
const CLAIMED_ID = "https://steamcommunity.com/openid/id/76561197960435530";

function assertion(overrides: Record<string, string | null> = {}) {
  const params = new URLSearchParams({
    state: STATE,
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.op_endpoint": "https://steamcommunity.com/openid/login",
    "openid.claimed_id": CLAIMED_ID,
    "openid.identity": CLAIMED_ID,
    "openid.return_to": `${ORIGIN}/api/auth/steam/callback?state=${STATE}`,
    "openid.response_nonce": "2026-10-03T11:59:30ZaBcDeF",
    "openid.assoc_handle": "1234567890",
    "openid.signed": "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
    "openid.sig": "c2lnbmF0dXJl",
  });
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  return params;
}

function steam(body = "ns:http://specs.openid.net/auth/2.0\nis_valid:true\n", status = 200) {
  const requests: URLSearchParams[] = [];
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    requests.push(new URLSearchParams(String(init?.body)));
    return new Response(body, { status });
  }) as typeof fetch;
  return { fetchImpl, requests };
}

function verify(params: URLSearchParams, fetchImpl: typeof fetch) {
  return verifySteamOpenIdCallback(params, { origin: ORIGIN, state: STATE, now: NOW, fetchImpl });
}

test("accepts a fresh assertion issued for this callback and browser", async () => {
  const { fetchImpl, requests } = steam();
  assert.equal(await verify(assertion(), fetchImpl), "76561197960435530");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].get("openid.mode"), "check_authentication");
  assert.equal(requests[0].get("openid.sig"), "c2lnbmF0dXJl");
  assert.equal(requests[0].has("state"), false);
});

test("rejects a valid Steam assertion that was issued to another site", async () => {
  const { fetchImpl, requests } = steam();
  await assert.rejects(verify(assertion({
    "openid.return_to": "https://evil.example/steam/callback",
  }), fetchImpl));
  assert.equal(requests.length, 0);
});

test("rejects an assertion from another browser's sign-in attempt", async () => {
  const { fetchImpl, requests } = steam();
  for (const returnTo of [
    `${ORIGIN}/api/auth/steam/callback?state=someone-else`,
    `${ORIGIN}/api/auth/steam/callback`,
    `${ORIGIN}/api/auth/steam/callback?state=${STATE}&extra=1`,
  ]) {
    await assert.rejects(verify(assertion({ "openid.return_to": returnTo }), fetchImpl));
  }
  assert.equal(requests.length, 0);
});

test("rejects assertions that are not positive Steam responses", async () => {
  const { fetchImpl, requests } = steam();
  const cases: Record<string, string>[] = [
    { "openid.mode": "cancel" },
    { "openid.ns": "http://openid.net/signon/1.1" },
    { "openid.op_endpoint": "https://evil.example/openid/login" },
  ];
  for (const overrides of cases) {
    await assert.rejects(verify(assertion(overrides), fetchImpl));
  }
  assert.equal(requests.length, 0);
});

test("rejects mismatched or malformed Steam identities", async () => {
  const { fetchImpl, requests } = steam();
  const cases: Record<string, string>[] = [
    { "openid.identity": "https://steamcommunity.com/openid/id/76561197960435531" },
    {
      "openid.claimed_id": "https://evil.example/openid/id/76561197960435530",
      "openid.identity": "https://evil.example/openid/id/76561197960435530",
    },
    {
      "openid.claimed_id": "https://steamcommunity.com/openid/id/123",
      "openid.identity": "https://steamcommunity.com/openid/id/123",
    },
  ];
  for (const overrides of cases) {
    await assert.rejects(verify(assertion(overrides), fetchImpl));
  }
  assert.equal(requests.length, 0);
});

test("rejects assertions whose signature does not cover critical fields", async () => {
  const { fetchImpl, requests } = steam();
  for (const field of ["return_to", "claimed_id", "response_nonce"]) {
    const signed = "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle"
      .split(",").filter((name) => name !== field).join(",");
    await assert.rejects(verify(assertion({ "openid.signed": signed }), fetchImpl));
  }
  assert.equal(requests.length, 0);
});

test("rejects stale, future and malformed nonces", async () => {
  const { fetchImpl, requests } = steam();
  for (const nonce of ["2026-10-03T11:49:00Zold", "2026-10-03T12:05:00Zahead", "not-a-nonce", null]) {
    await assert.rejects(verify(assertion({ "openid.response_nonce": nonce }), fetchImpl));
  }
  assert.equal(requests.length, 0);
});

test("rejects when Steam does not confirm the signature", async () => {
  for (const [body, status] of [
    ["ns:http://specs.openid.net/auth/2.0\nis_valid:false\n", 200],
    ["ns:http://specs.openid.net/auth/2.0\nnot_is_valid:true\n", 200],
    ["ns:http://specs.openid.net/auth/2.0\nis_valid:true\n", 500],
  ] as const) {
    await assert.rejects(verify(assertion(), steam(body, status).fetchImpl));
  }
});

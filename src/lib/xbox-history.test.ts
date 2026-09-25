import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchXboxTitleHistories } from "./xbox-history.ts";

const auth = { xuid: "1234", authorizationHeader: "test-authorization" };
const json = (value: unknown) => Response.json(value);
const page = (titles: unknown[], token: string | null = null) => json({ titles, pagingInfo: { continuationToken: token } });
const games = (start: number, count: number) => Array.from({ length: count }, (_, i) => ({ titleId: String(start + i), name: `Game ${start + i}` }));

test("reads a 525-title history, short/empty pages, opaque cursors and overlaps without a 200-title cutoff", async t => {
  const tokens: Array<string | null> = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = new URL(input);
    assert.equal(new Headers(init?.headers).get("Authorization"), auth.authorizationHeader);
    if (url.hostname === "titlehub.xboxlive.com") {
      assert.equal(url.searchParams.has("maxItems"), false, "TitleHub must not truncate the recent history");
      return json({ titles: games(1, 200) });
    }
    assert.equal(url.searchParams.get("maxItems"), "100");
    const token = url.searchParams.get("continuationToken");
    tokens.push(token);
    if (token === null) return page(games(1, 32), "opaque +/&=1");
    if (token === "opaque +/&=1") return page([], "empty-page-next");
    if (token === "empty-page-next") return page(games(30, 300), "last");
    assert.equal(token, "last");
    return page(games(329, 197));
  });
  const result = await fetchXboxTitleHistories(auth);
  assert.equal(result.length, 525);
  assert.equal(new Set(result.map(g => g.providerGameId)).size, 525);
  assert.equal(result.find(g => g.providerGameId === "titleId:525")?.rawData?.syncSource, "xbox-achievement-title-history");
  assert.deepEqual(tokens, [null, "opaque +/&=1", "empty-page-next", "last"]);
});

test("also follows TitleHub cursors if provided and merges IDs across both sources", async t => {
  t.mock.method(globalThis, "fetch", async (input: string | URL) => {
    const url = new URL(input);
    if (url.hostname === "achievements.xboxlive.com") return page(games(1, 2));
    return url.searchParams.has("continuationToken") ? page(games(2, 2)) : page(games(1, 1), "next");
  });
  assert.equal((await fetchXboxTitleHistories(auth)).length, 3);
});

test("empty histories terminate without issuing unnecessary next-page requests", async t => {
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL) => { requests.push(String(input)); return page([]); });
  assert.deepEqual(await fetchXboxTitleHistories(auth), []);
  assert.equal(requests.length, 2);
});

for (const failedSource of ["achievements.xboxlive.com", "titlehub.xboxlive.com"]) {
  test(`a later page failure on ${failedSource} rejects the read instead of returning partial success`, async t => {
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
      const url = new URL(input);
      if (url.hostname !== failedSource) return page(games(1, 4));
      if (!url.searchParams.has("continuationToken")) return page(games(1, 2), "next");
      return new Response("rate limited", { status: 429, headers: { "retry-after": "20" } });
    });
    await assert.rejects(fetchXboxTitleHistories(auth), (error: Error & { retryAfter?: string }) => {
      assert.match(error.message, /429/);
      assert.equal(error.retryAfter, "20");
      return true;
    });
  });
}

test("repeated continuation tokens fail without looping or reporting a truncated library", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL) => {
    if (new URL(input).hostname === "titlehub.xboxlive.com") return page([]);
    calls++;
    return page(games(1, 2), "repeated");
  });
  await assert.rejects(fetchXboxTitleHistories(auth), /did not advance/);
  assert.equal(calls, 2);
});

for (const invalid of [{ titles: null }, { titles: [] }, { titles: [], pagingInfo: {} }, { titles: [], pagingInfo: { continuationToken: 123 } }]) {
  test(`invalid achievement history cannot be mistaken for completion: ${JSON.stringify(invalid)}`, async t => {
    t.mock.method(globalThis, "fetch", async (input: string | URL) => new URL(input).hostname === "titlehub.xboxlive.com" ? page([]) : json(invalid));
    await assert.rejects(fetchXboxTitleHistories(auth), /invalid|pagination/);
  });
}

test("cancellation stops further pages and does not return accumulated titles", async t => {
  const controller = new AbortController();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    if (new URL(input).hostname === "titlehub.xboxlive.com") return page([]);
    calls++;
    assert.ok(init?.signal);
    controller.abort();
    return page(games(1, 2), "next");
  });
  await assert.rejects(fetchXboxTitleHistories(auth, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(calls, 1);
});

test("a source failure cancels the other in-flight history request", async t => {
  let siblingAborted = false;
  t.mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    if (new URL(input).hostname === "achievements.xboxlive.com") return new Response("unavailable", { status: 503 });
    return new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => { siblingAborted = true; reject(new Error("cancelled")); }, { once: true });
    });
  });
  await assert.rejects(fetchXboxTitleHistories(auth), /503/);
  assert.equal(siblingAborted, true);
});

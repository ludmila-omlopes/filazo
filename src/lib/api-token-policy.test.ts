import assert from "node:assert/strict";
import test from "node:test";
import {
  createApiTokenSecret,
  hashApiToken,
  normalizeApiTokenName,
  parseLibraryApiQuery,
  readBearerToken,
} from "./api-token-policy.ts";

test("API keys are random, stored only as a hash, and readable from a Bearer header", () => {
  const first = createApiTokenSecret();
  const second = createApiTokenSecret();
  assert.notEqual(first.token, second.token);
  assert.match(first.token, /^flz_[A-Za-z0-9_-]{43}$/);
  assert.equal(first.tokenHash, hashApiToken(first.token));
  assert.ok(!first.tokenHash.includes(first.token));
  assert.ok(first.token.startsWith(first.prefix));

  assert.equal(readBearerToken(`Bearer ${first.token}`), first.token);
  assert.equal(readBearerToken(`bearer ${first.token}`), first.token);
  assert.equal(readBearerToken(first.token), null);
  assert.equal(readBearerToken(`Bearer ${first.token}x`), null);
  assert.equal(readBearerToken("Bearer flz_short"), null);
  assert.equal(readBearerToken(null), null);
});

test("key names are trimmed and bounded", () => {
  assert.equal(normalizeApiTokenName("  My   blog "), "My blog");
  assert.equal(normalizeApiTokenName("   "), null);
  assert.equal(normalizeApiTokenName("x".repeat(61)), null);
  assert.equal(normalizeApiTokenName(null), null);
});

test("library query accepts known statuses, bounded limits and opaque cursors", () => {
  const parse = (query: string) => parseLibraryApiQuery(new URLSearchParams(query));

  assert.deepEqual(parse(""), { ok: true, query: { statuses: null, limit: 50, cursor: null } });
  assert.deepEqual(parse("status=playing,COMPLETED,playing&limit=10&cursor=abc123"), {
    ok: true,
    query: { statuses: ["PLAYING", "COMPLETED"], limit: 10, cursor: "abc123" },
  });
  assert.equal(parse("status=playing_next").ok, true);
  assert.equal(parse("status=deleted").ok, false);
  assert.equal(parse("limit=0").ok, false);
  assert.equal(parse("limit=101").ok, false);
  assert.equal(parse("limit=2.5").ok, false);
  assert.equal(parse("cursor=../x").ok, false);
});

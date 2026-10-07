import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, mocks) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  new Function("require", "exports", outputText)(name => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, exports);
  return exports;
}

const stamp = "2026-10-07T12:00:00.123Z";
function publicGame(slug = "elden-ring") {
  return {
    id: slug, slug, name: "Elden Ring", genres: ["RPG"], igdbId: 119133,
    releaseDate: new Date(stamp), createdAt: new Date(stamp), updatedAt: new Date(stamp),
    completionModelCheckedAt: null, igdbCheckedAt: new Date(stamp),
    hltbUpdatedAt: null, hltbCheckedAt: null, metacriticUpdatedAt: null,
    metacriticCheckedAt: null, upcomingReleasesCheckedAt: null,
    // A provider-owned JSON date must remain a string, not become a Date.
    upcomingReleases: [{ releaseDate: stamp }],
    providerLinks: [{ provider: "STEAM", providerGameId: "1245620", createdAt: new Date(stamp),
      updatedAt: new Date(stamp), storyAchievementCheckedAt: null }],
    marketplaceSnapshots: [{ region: "BR", offers: [], subscriptions: [], checkedAt: new Date(stamp) }],
    steamReviewSnapshots: [{ language: "en", appId: "1245620", reviews: [], summary: {}, checkedAt: new Date(stamp) }],
  };
}

function setup() {
  const stored = new Map();
  const publicReads = [];
  const personalReads = [];
  const states = { alice: "PLAYING", bob: "COMPLETED" };
  let game = publicGame();
  let failure;
  let clock = 0;
  const db = {
    game: { findUnique: async args => {
      publicReads.push(args);
      if (failure) throw failure;
      if (args.where.slug === "missing") return null;
      if (args.select) return game && { name: game.name, slug: game.slug, summary: "Public synopsis" };
      assert.deepEqual(Object.keys(args.include).sort(), ["marketplaceSnapshots", "providerLinks", "steamReviewSnapshots"]);
      assert.deepEqual(args.include.providerLinks, { omit: { rawData: true } });
      return game;
    } },
    userGameEntry: { findMany: async args => {
      personalReads.push(args);
      assert.ok(args.take <= 64);
      assert.equal(args.where.gameId, "elden-ring");
      const id = args.where.userId;
      assert.ok(id in states);
      return [{ id: `${id}-entry`, userId: id, status: states[id], notes: `${id} private note`,
        currentPlayingSlot: null, playtimeSource: "manual", updatedAt: new Date(stamp) }];
    } },
    userGameReview: { findMany: async args => {
      assert.ok(args.where.userId in states);
      return [{ userId: args.where.userId, body: `${args.where.userId} private review` }];
    } },
    user: { findMany: async args => {
      assert.ok(args.where.id.not in states);
      assert.ok(args.take <= 6);
      return [];
    } },
    gameJournalEntry: { findMany: async args => {
      assert.equal(args.where.userGameEntryId, `${args.where.userId}-entry`);
      return [{ userId: args.where.userId, body: `${args.where.userId} private journal` }];
    } },
  };
  const queries = load("../src/lib/game-detail-queries.ts", {
    "@prisma/client": require("@prisma/client"),
    "@/lib/assistant/marketplace-search": { parseMarketplaceSnapshot: value => value },
    "@/lib/steam-reviews": { parseSteamReviewsSnapshot: value => value },
    "@/lib/game-indexing": {}, "@/lib/game-affinity": {},
  });
  const service = load("../src/lib/game-detail-cache.ts", {
    "server-only": {}, "react": { cache: fn => fn }, "@/lib/prisma": { prisma: db },
    "@/lib/game-detail-queries": queries,
    "next/cache": { unstable_cache: (fn, parts, options) => async (...args) => {
      assert.equal(options.revalidate, 300);
      const key = JSON.stringify([parts, args]);
      const hit = stored.get(key);
      if (hit && hit.expires > clock) return JSON.parse(hit.json);
      const result = await fn(...args);
      const json = JSON.stringify(result);
      stored.set(key, { json, expires: clock + options.revalidate });
      return JSON.parse(json);
    } },
  });
  return { service, stored, publicReads, personalReads, states,
    setGame: value => { game = value; }, setFailure: value => { failure = value; },
    advance: seconds => { clock += seconds; } };
}

test("shared public cache never includes personal state, even when warmed by a signed-in user", async () => {
  const f = setup();
  const alice = await f.service.getCachedGameDetail("elden-ring", "alice");
  const bob = await f.service.getCachedGameDetail("elden-ring", "bob");
  const anonymous = await f.service.getCachedGameDetail("elden-ring", null);
  assert.equal(f.publicReads.length, 1);
  assert.equal(f.personalReads.length, 2);
  assert.equal(alice.userEntries[0].notes, "alice private note");
  assert.equal(bob.userEntries[0].notes, "bob private note");
  assert.equal(bob.journalEntries[0].body, "bob private journal");
  for (const key of ["userEntries", "userReviews", "journalEntries", "communityEntries"]) {
    assert.deepEqual(anonymous[key], []);
  }
  for (const { json } of f.stored.values()) {
    assert.doesNotMatch(json, /alice|bob|private note|private review|private journal|userEntries|communityEntries/);
  }
  f.states.alice = "DROPPED";
  const updated = await f.service.getCachedGameDetail("elden-ring", "alice");
  assert.equal(updated.userEntries[0].status, "DROPPED");
  assert.equal(f.publicReads.length, 1, "status edits remain fresh without flushing the public cache");
});

test("cold and warm reads preserve schema dates, nulls and public JSON strings", async () => {
  const f = setup();
  for (let i = 0; i < 2; i++) {
    const game = await f.service.getCachedGameDetail("elden-ring", null);
    assert.equal(game.releaseDate.toISOString(), stamp);
    assert.equal(game.updatedAt.toISOString(), stamp);
    assert.equal(game.providerLinks[0].createdAt.toISOString(), stamp);
    assert.equal(game.igdbCheckedAt.toISOString(), stamp);
    assert.equal(game.hltbUpdatedAt, null);
    assert.equal(game.providerLinks[0].storyAchievementCheckedAt, null);
    assert.equal(game.upcomingReleases[0].releaseDate, stamp);
    assert.equal(game.marketplaceSnapshots[0].checkedAt, stamp);
    assert.equal(game.steamReviewSnapshots[0].checkedAt, stamp);
  }
});

test("a missing game is not persisted, so a later import appears immediately", async () => {
  const f = setup();
  f.setGame(null);
  assert.equal(await f.service.getCachedGameDetail("elden-ring", null), null);
  assert.equal(await f.service.getCachedGameMetadata("elden-ring"), null);
  assert.equal(f.stored.size, 0);
  f.setGame(publicGame());
  assert.equal((await f.service.getCachedGameDetail("elden-ring", null)).name, "Elden Ring");
  assert.equal((await f.service.getCachedGameMetadata("elden-ring")).name, "Elden Ring");
});

test("database errors are propagated and do not poison public cache entries", async () => {
  const f = setup();
  const error = new Error("database unavailable");
  f.setFailure(error);
  await assert.rejects(f.service.getCachedGameDetail("elden-ring", null), error);
  await assert.rejects(f.service.getCachedGameMetadata("elden-ring"), error);
  assert.equal(f.stored.size, 0);
  f.setFailure(undefined);
  assert.equal((await f.service.getCachedGameDetail("elden-ring", null)).slug, "elden-ring");
});

test("public entries expire and cache keys separate slugs and metadata from full details", async () => {
  const f = setup();
  await f.service.getCachedGameDetail("elden-ring", null);
  await f.service.getCachedGameMetadata("elden-ring");
  await f.service.getCachedGameMetadata("elden-ring");
  assert.equal(await f.service.getCachedGameMetadata("missing"), null);
  assert.equal(f.publicReads.length, 3);
  f.setGame({ ...publicGame(), name: "Updated public title" });
  f.advance(301);
  assert.equal((await f.service.getCachedGameDetail("elden-ring", null)).name, "Updated public title");
  assert.equal((await f.service.getCachedGameMetadata("elden-ring")).name, "Updated public title");
});

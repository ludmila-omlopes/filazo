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

/** In-memory stand-in for the Data Cache: time-based expiry plus tag invalidation. */
function fakeNextCache() {
  const stored = new Map();
  const invalidated = new Map();
  const options = [];
  let clock = 0;
  let version = 0;
  return {
    stored, options,
    advance: seconds => { clock += seconds; },
    module: {
      unstable_cache: (fn, parts, cacheOptions) => async (...args) => {
        options.push(cacheOptions);
        const key = JSON.stringify([parts, args]);
        const hit = stored.get(key);
        const expired = hit && (hit.expires <= clock || hit.tags.some(tag => (invalidated.get(tag) ?? -1) >= hit.version));
        if (hit && !expired) return JSON.parse(hit.json);
        const result = await fn(...args);
        const json = JSON.stringify(result);
        const expires = cacheOptions.revalidate === false ? Infinity : clock + cacheOptions.revalidate;
        stored.set(key, { json, expires, tags: cacheOptions.tags ?? [], version: ++version });
        return JSON.parse(json);
      },
      revalidateTag: (tag, profile) => {
        assert.deepEqual(profile, { expire: 0 });
        invalidated.set(tag, version);
      },
    },
  };
}

function setup() {
  const publicReads = [];
  const personalReads = [];
  const relatedReads = [];
  const states = { alice: "PLAYING", bob: "COMPLETED" };
  let game = publicGame();
  let failure;
  const db = {
    game: { findUnique: async args => {
      publicReads.push(args);
      if (failure) throw failure;
      if (args.where.slug === "missing") return null;
      if (args.where.id) return { igdbId: null };
      if (args.select) return game && { name: game.name, slug: game.slug, summary: "Public synopsis" };
      assert.deepEqual(Object.keys(args.include).sort(), ["marketplaceSnapshots", "providerLinks", "steamReviewSnapshots"]);
      assert.deepEqual(args.include.providerLinks, { omit: { rawData: true } });
      return game && { ...game, slug: args.where.slug };
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
  const cache = fakeNextCache();
  const queries = load("../src/lib/game-detail-queries.ts", {
    "@prisma/client": require("@prisma/client"),
    "@/lib/assistant/marketplace-search": { parseMarketplaceSnapshot: value => value },
    "@/lib/steam-reviews": { parseSteamReviewsSnapshot: value => value },
    "@/lib/game-indexing": {}, "@/lib/game-affinity": {},
  });
  const tags = load("../src/lib/public-game-cache.ts", { "next/cache": cache.module });
  const service = load("../src/lib/game-detail-cache.ts", {
    "server-only": {}, "react": { cache: fn => fn }, "@/lib/prisma": { prisma: db },
    "@/lib/public-game-cache": tags,
    "@/lib/game-detail-queries": { ...queries, readRelatedGames: async (_db, source) => {
      relatedReads.push(source.id);
      return [{ slug: "dark-souls", name: "Dark Souls", coverUrl: "cover", reason: { kind: "similar" } }];
    } },
    "next/cache": cache.module,
  });
  return { service, tags, cache, publicReads, personalReads, relatedReads, states,
    setGame: value => { game = value; }, setFailure: value => { failure = value; } };
}

test("shared public cache never includes personal state, even when warmed by a signed-in user", async () => {
  const f = setup();
  const alice = await f.service.getCachedGameDetail("elden-ring", "alice");
  const bob = await f.service.getCachedGameDetail("elden-ring", "bob");
  const anonymous = await f.service.getCachedGameDetail("elden-ring", null);
  assert.equal(f.publicReads.length, 2, "members share one copy; visitors use their own long-lived copy");
  assert.equal(f.personalReads.length, 2);
  assert.equal(alice.userEntries[0].notes, "alice private note");
  assert.equal(bob.userEntries[0].notes, "bob private note");
  assert.equal(bob.journalEntries[0].body, "bob private journal");
  for (const key of ["userEntries", "userReviews", "journalEntries", "communityEntries"]) {
    assert.deepEqual(anonymous[key], []);
  }
  for (const { json } of f.cache.stored.values()) {
    assert.doesNotMatch(json, /alice|bob|private note|private review|private journal|userEntries|communityEntries/);
  }
  f.states.alice = "DROPPED";
  const updated = await f.service.getCachedGameDetail("elden-ring", "alice");
  assert.equal(updated.userEntries[0].status, "DROPPED");
  assert.equal(f.publicReads.length, 2, "status edits remain fresh without flushing the public cache");
});

test("cold and warm reads preserve schema dates, nulls and public JSON strings", async () => {
  const f = setup();
  for (const userId of [null, null, "alice", "alice"]) {
    const game = await f.service.getCachedGameDetail("elden-ring", userId);
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
  assert.equal(f.cache.stored.size, 0);
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
  assert.equal(f.cache.stored.size, 0);
  f.setFailure(undefined);
  assert.equal((await f.service.getCachedGameDetail("elden-ring", null)).slug, "elden-ring");
});

test("member copies expire after five minutes; visitor copies wait for a write to the game", async () => {
  const f = setup();
  await f.service.getCachedGameDetail("elden-ring", "alice");
  await f.service.getCachedGameDetail("elden-ring", null);
  await f.service.getCachedGameMetadata("elden-ring");
  assert.equal(f.publicReads.length, 3);
  assert.ok(f.cache.options.some(options => options.revalidate === 300));
  assert.ok(f.cache.options.every(options => options.revalidate === 300 || options.revalidate === false));
  assert.ok(f.cache.options.every(options => options.tags.includes("game:elden-ring")));

  f.setGame({ ...publicGame(), name: "Updated public title" });
  f.cache.advance(30 * 86_400);
  assert.equal((await f.service.getCachedGameDetail("elden-ring", "alice")).name, "Updated public title");
  assert.equal((await f.service.getCachedGameDetail("elden-ring", null)).name, "Elden Ring",
    "crawler visits a month later still read no database");
  assert.equal((await f.service.getCachedGameMetadata("elden-ring")).name, "Elden Ring");
  assert.equal(f.publicReads.length, 4);

  f.tags.revalidateGamePage("elden-ring");
  assert.equal((await f.service.getCachedGameDetail("elden-ring", null)).name, "Updated public title");
  assert.equal((await f.service.getCachedGameMetadata("elden-ring")).name, "Updated public title");
});

test("revalidating one game leaves other games' visitor copies untouched", async () => {
  const f = setup();
  await f.service.getCachedGameDetail("elden-ring", null);
  await f.service.getCachedGameDetail("hades", null);
  await f.service.getCachedRelatedGames({ id: "hades", slug: "hades" });
  assert.equal(f.publicReads.length, 2);
  assert.deepEqual(f.relatedReads, ["hades"]);
  f.tags.revalidateGamePage("elden-ring");
  await f.service.getCachedGameDetail("elden-ring", null);
  await f.service.getCachedGameDetail("hades", null);
  await f.service.getCachedRelatedGames({ id: "hades", slug: "hades" });
  assert.equal(f.publicReads.length, 3);
  assert.deepEqual(f.relatedReads, ["hades"]);
  f.tags.revalidateGamePage("hades");
  await f.service.getCachedRelatedGames({ id: "hades", slug: "hades" });
  assert.deepEqual(f.relatedReads, ["hades", "hades"], "new related games appear after discovery publishes");
});

test("revalidation outside a request is ignored instead of failing the writer", () => {
  const tags = load("../src/lib/public-game-cache.ts", {
    "next/cache": { revalidateTag: () => { throw new Error("Invariant: static generation store missing"); } },
  });
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    assert.doesNotThrow(() => tags.revalidateGamePage("elden-ring"));
  } finally {
    console.warn = warn;
  }
});

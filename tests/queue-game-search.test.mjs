import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as metadata from "../src/lib/game-metadata.ts";
import * as policy from "../src/lib/abuse-policy.ts";

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  new Function("require", "exports", outputText)(name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) return {};
    return require(name);
  }, exports);
  return exports;
}
const utils = load("../src/lib/utils.ts");
const control = {
  id: "control-canonical", igdbId: null, name: "Control", normalizedName: "control", slug: "control",
  coverUrl: null, summary: null, releaseDate: new Date("2019-08-27"),
  platforms: ["PC"], genres: [{ name: "Adventure" }],
};

function searchFixture({ exact = [control], library = [], catalog = [], remote = [], matched = [], entries = [], fail = false } = {}) {
  const reads = [];
  let providerCalls = 0;
  const service = load("../src/lib/queue-game-search.ts", {
    "@/lib/utils": utils, "@/lib/game-metadata": metadata,
    "@/lib/igdb": { searchIgdbGames: async (query, limit, signal) => {
      providerCalls++;
      assert.equal(limit, 8);
      assert.ok(signal instanceof AbortSignal);
      if (fail) throw new Error("provider unavailable");
      return remote;
    } },
    "@/lib/prisma": { prisma: {
      game: { findMany: async args => {
        reads.push(args);
        assert.ok(args.take <= 16);
        assert.equal(args.select.userEntries, undefined);
        if (args.where.AND) {
          assert.equal(args.where.AND[1].userEntries.some.userId, "user-a");
          return library;
        }
        if (args.where.OR[0].igdbId) return matched;
        return args.where.OR[0].name.equals ? exact : catalog;
      } },
      userGameEntry: { findMany: async args => {
        assert.equal(args.where.userId, "user-a");
        assert.ok(args.where.gameId.in.length <= 8);
        return entries;
      } },
    } },
  });
  return { service, reads, get providerCalls() { return providerCalls; } };
}

test("Control in the catalog is returned even without an external ID or external results", async () => {
  const { service } = searchFixture({ entries: [{ gameId: control.id, status: "OWNED", userIntent: null, isPhysicalCopy: false }] });
  const results = await service.searchQueueGames("Control", "user-a");
  assert.equal(results.length, 1);
  assert.equal(results[0].gameId, control.id);
  assert.equal(results[0].igdbId, null);
  assert.equal(results[0].isOwned, true);
  assert.deepEqual(results[0].genres, ["Adventure"]);
  assert.equal(results[0].releaseDate, "2019-08-27T00:00:00.000Z");
});

test("eight external matches cannot hide the exact catalog title or the user's edition", async () => {
  const edition = { ...control, id: "ultimate", name: "Control Ultimate Edition", normalizedName: "control ultimate edition" };
  const { service } = searchFixture({ library: [edition], remote: Array.from({ length: 8 }, (_, i) => ({ name: `Other Control ${i}`, igdbId: i + 1 })) });
  const results = await service.searchQueueGames("Control", "user-a");
  assert.deepEqual(results.slice(0, 2).map(game => game.gameId), [control.id, edition.id]);
  assert.equal(results.length, 8);
});

test("provider failure leaves local results available", async () => {
  const { service } = searchFixture({ fail: true });
  assert.equal((await service.searchQueueGames("Control", "user-a"))[0].gameId, control.id);
});

test("catalog and remote representations of the same canonical game are deduplicated", async () => {
  const { service } = searchFixture({ library: [control], catalog: [control], remote: [{ name: "Control", igdbId: 10 }], matched: [control] });
  assert.equal((await service.searchQueueGames("Control", "user-a")).length, 1);
});

test("full catalog results require no provider; empty normalization never matches every title", async () => {
  const fixture = searchFixture({ exact: Array.from({ length: 8 }, (_, i) => ({ ...control, id: String(i) })) });
  assert.equal((await fixture.service.searchQueueGames("™™", "user-a")).length, 8);
  assert.equal(fixture.providerCalls, 0);
  assert.ok(fixture.reads.every(args => !JSON.stringify(args.where).includes('"normalizedName"')));
});

test("remote-only matches use the existing catalog ID and only this user's badges", async () => {
  const { service } = searchFixture({ exact: [], remote: [{ name: "Control", igdbId: 10 }], matched: [{ ...control, igdbId: 10 }], entries: [
    { gameId: control.id, status: "PLAYING_NEXT", userIntent: "needs_purchase", isPhysicalCopy: false },
  ] });
  const [result] = await service.searchQueueGames("Control", "user-a");
  assert.equal(result.gameId, control.id);
  assert.equal(result.isOwned, false);
  assert.equal(result.isQueued, true);
});

function resolverFixture(game = control) {
  const calls = [];
  const service = load("../src/lib/queue-game.ts", {
    "@/lib/prisma": { prisma: { game: { findUnique: async args => { calls.push(args.where); return game; } } } },
    "@/lib/igdb": { getIgdbGameById: async () => { calls.push("metadata"); return { name: "Control", igdbId: 10 }; } },
    "@/lib/catalog": { resolveCatalogGame: async args => { calls.push(args); return control; } },
  });
  return { service, calls };
}

test("queueing a catalog game reuses its ID without enrichment or global writes", async () => {
  const { service, calls } = resolverFixture();
  const result = await service.resolveQueueGame({ gameId: control.id, igdbId: null, platformName: null });
  assert.equal(result.id, control.id);
  assert.deepEqual(calls, [{ id: control.id }]);
});

test("stale catalog IDs cannot create a replacement from client metadata", async () => {
  const { service, calls } = resolverFixture(null);
  await assert.rejects(service.resolveQueueGame({ gameId: "deleted", igdbId: 10, platformName: null }), /no longer/);
  assert.deepEqual(calls, [{ id: "deleted" }]);
});

test("new external games continue through canonical catalog resolution", async () => {
  const { service, calls } = resolverFixture(null);
  await service.resolveQueueGame({ gameId: null, igdbId: 10, platformName: "PC" });
  assert.deepEqual(calls[0], { igdbId: 10 });
  assert.equal(calls[1], "metadata");
  assert.equal(calls[2].providerGameId, "10");
  assert.equal(calls[2].metadata.name, "Control");
});

test("queue search authenticates and validates before querying, without changing other search consumers", async () => {
  let userId = null;
  let queueCalls = 0;
  let legacyCalls = 0;
  const route = load("../src/app/api/profile/game-search/route.ts", {
    "@/lib/session": { getSessionUserId: async () => userId },
    "@/lib/abuse-policy": policy,
    "@/lib/abuse-request": { checkApiAbuse: async () => null },
    "@/lib/queue-game-search": { searchQueueGames: async (q, user) => { assert.equal(user, "user-a"); queueCalls++; return [{ gameId: control.id }]; } },
    "@/lib/igdb": { searchIgdbGames: async () => { legacyCalls++; return []; } },
  });
  const request = query => new Request(`https://filazo.app/api/profile/game-search?${query}`);
  assert.equal((await route.GET(request("scope=queue&q=Control"))).status, 401);
  userId = "user-a";
  assert.equal((await route.GET(request(`scope=queue&q=${"a".repeat(161)}`))).status, 400);
  assert.deepEqual(await (await route.GET(request("scope=queue&q=c"))).json(), { results: [] });
  assert.equal(queueCalls, 0);
  assert.deepEqual(await (await route.GET(request("scope=queue&q=Control"))).json(), { results: [{ gameId: control.id }] });
  await route.GET(request("q=Control"));
  assert.equal(queueCalls, 1);
  assert.equal(legacyCalls, 1);
});

function actionFixture({ status = "OWNED", userId = "user-a" } = {}) {
  const writes = [];
  let resolutions = 0;
  const actions = load("../src/app/profile/actions.ts", {
    "@/lib/session": { getSessionUserId: async () => userId },
    "next/cache": { revalidatePath() {} },
    "@/lib/queue-game": { resolveQueueGame: async input => {
      assert.equal(input.gameId, control.id);
      assert.equal(input.igdbId, null);
      resolutions++;
      return control;
    } },
    "@/lib/library-entry": {
      lockLibraryGame: async (_tx, owner) => assert.equal(owner, "user-a"),
      upsertLibraryCopy: async input => writes.push(input),
    },
    "@/lib/prisma": { prisma: {
      userGameEntry: { findMany: async ({ where }) => {
        assert.deepEqual(where, { userId: "user-a", gameId: control.id });
        return [{ id: "owned-copy", gameId: control.id, currentPlayingSlot: null, finishedAt: null, isPhysicalCopy: false, userIntent: null, status, platformName: "PlayStation 5" }];
      } },
      $transaction: async callback => callback({ userGameEntry: {
        findMany: async ({ where }) => { assert.equal(where.userId, "user-a"); return []; },
        updateMany: async ({ where }) => { assert.equal(where.userId, "user-a"); return { count: 1 }; },
      } }),
    } },
  });
  const form = new FormData();
  form.set("gameId", control.id);
  form.set("title", "Control");
  form.set("platformName", "PC");
  form.set("slot", "1");
  return { actions, form, writes, get resolutions() { return resolutions; } };
}

test("the actual queue action accepts a catalog-only game and preserves the owned platform", async () => {
  const { actions, form, writes } = actionFixture();
  assert.deepEqual(await actions.addPlayingNextGameAction(form), { ok: true });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].userId, "user-a");
  assert.equal(writes[0].gameId, control.id);
  assert.equal(writes[0].platformName, "PlayStation 5");
  assert.equal(writes[0].provider, null);
  assert.equal(writes[0].update.playingNextSlot, 1);
});

test("queue action still refuses completed games and unauthenticated or unidentified selections", async () => {
  const completed = actionFixture({ status: "COMPLETED" });
  assert.equal((await completed.actions.addPlayingNextGameAction(completed.form)).ok, false);
  assert.equal(completed.writes.length, 0);
  const anonymous = actionFixture({ userId: null });
  assert.equal((await anonymous.actions.addPlayingNextGameAction(anonymous.form)).ok, false);
  assert.equal(anonymous.resolutions, 0);
  const invalid = actionFixture();
  invalid.form.delete("gameId");
  assert.equal((await invalid.actions.addPlayingNextGameAction(invalid.form)).ok, false);
  assert.equal(invalid.resolutions, 0);
});

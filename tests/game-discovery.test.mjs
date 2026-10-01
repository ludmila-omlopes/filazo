import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as affinity from "../src/lib/game-affinity.ts";
const require = createRequire(import.meta.url);
function load(path, mocks) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  new Function("require", "exports", outputText)(name => name in mocks ? mocks[name] : name.startsWith("@/") ? {} : require(name), exports);
  return exports;
}
const profile = id => ({ igdbId: id, keywords: [{ id: 1, name: "soulslike" }], genres: [], themes: [], perspectives: [], modes: [], developers: [], collections: [], similarIds: [] });

test("worker imports a missing game canonically, suppresses alternate editions and keeps existing provider data", async () => {
  const writes = []; const resolutions = [];
  const db = {
    gameMetadataJob: { count: async () => 1, updateMany: async () => ({ count: 1 }) },
    game: { findUnique: async () => ({ igdbId: 1 }) },
    gameProviderLink: { findUnique: async () => ({ gameId: "source", rawData: { preserved: true } }), upsert: async args => writes.push(args) },
  };
  db.$transaction = async fn => fn(db);
  const service = load("../src/lib/game-discovery.ts", {
    "@/lib/prisma": { prisma: db }, "@/lib/game-affinity": affinity,
    "@/lib/game-indexing": { looksLikeGameExtra: () => false },
    "@/lib/igdb": { fetchIgdbDiscovery: async () => ({ profile: profile(1), games: [
      { familyId: 2, profile: profile(2), metadata: { name: "Dark Souls", igdbId: 2, coverUrl: "cover" } },
      { familyId: 2, profile: profile(3), metadata: { name: "Dark Souls Remastered", igdbId: 3, coverUrl: "cover" } },
    ] }) },
    "@/lib/catalog": { resolveCatalogGame: async args => { resolutions.push(args); return { id: "canonical" }; } },
  });
  await service.prepareGameDiscovery("source", "production:discovery", "lease", new AbortController().signal);
  assert.equal(resolutions.length, 1);
  assert.equal(resolutions[0].provider, "IGDB"); assert.equal(resolutions[0].deferEnrichment, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].update.rawData.preserved, true);
  assert.deepEqual(writes[0].update.rawData.gameDiscovery.recommendations.map(r => r.gameId), ["canonical"]);
});
test("lost lease prevents external calls and catalog writes", async () => {
  const service = load("../src/lib/game-discovery.ts", { "@/lib/game-affinity": affinity,
    "@/lib/prisma": { prisma: { gameMetadataJob: { count: async () => 0 } } },
  });
  await assert.rejects(service.prepareGameDiscovery("source", "production:discovery", "lost", new AbortController().signal), /lease expired/);
});
test("page reads preserve prepared rank, allow sparse metadata and never load personal records", async () => {
  const snapshot = { version: 1, profile: profile(1), refreshAfter: new Date().toISOString(), recommendations: [
    { gameId: "b", score: 80, reason: { kind: "mechanic", mechanic: "soulslike" } },
    { gameId: "a", score: 70, reason: { kind: "similar" } },
  ] };
  const db = {
    gameProviderLink: { findUnique: async () => ({ gameId: "source", rawData: { gameDiscovery: snapshot } }) },
    game: { findUnique: async () => ({ igdbId: 1 }), findMany: async args => {
      assert.equal(args.take, 6); assert.equal(args.select.userEntries, undefined);
      return [{ id: "a", name: "A", slug: "a", coverUrl: "c" }, { id: "b", name: "B", slug: "b", coverUrl: "c" }];
    } },
  };
  const service = load("../src/lib/game-detail-queries.ts", { "@/lib/game-affinity": affinity,
    "@/lib/game-indexing": { looksLikeGameExtra: () => false },
  });
  assert.deepEqual((await service.readRelatedGames(db, { id: "source", genres: [] })).map(r => r.slug), ["b", "a"]);
  db.gameProviderLink.findUnique = async () => ({ gameId: "source", rawData: null });
  assert.deepEqual(await service.readRelatedGames(db, { id: "source", genres: [] }), []);
});
test("worker rejects unsigned requests before database/provider access", async () => {
  const route = load("../src/app/api/internal/game-discovery-worker/route.ts", {
    "@/lib/internal-worker-auth": { hasInternalWorkerAuth: () => false },
  });
  assert.equal((await route.GET(new Request("https://filazo.app/api/internal/game-discovery-worker"))).status, 401);
});

test("provider lookup targets the specific family and requires both candidate reads to finish", async () => {
  const previousFetch = globalThis.fetch;
  const previousId = process.env.IGDB_CLIENT_ID;
  const previousSecret = process.env.IGDB_CLIENT_SECRET;
  process.env.IGDB_CLIENT_ID = "test-id"; process.env.IGDB_CLIENT_SECRET = "test-secret";
  const bodies = [];
  let failing = false;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("oauth2/token")) return Response.json({ access_token: "test-token", expires_in: 3600 });
    bodies.push(init.body);
    if (init.body.includes("where id = 1;")) return Response.json([{
      id: 1, name: "Source", keywords: [{ id: 17326, name: "soulslike" }], similar_games: [2],
    }]);
    if (init.body.includes("where keywords")) {
      if (failing) return new Response(null, { status: 429 });
      return Response.json([
        { id: 3, name: "Expansion", game_type: { type: "Expansion" } },
        { id: 4, name: "Complete Remaster", parent_game: 2, game_type: { type: "Remaster" } },
      ]);
    }
    return Response.json([{ id: 2, name: "Similar Game", game_type: { type: "Main Game" } }]);
  };
  try {
    const service = load("../src/lib/igdb.ts", { "@/lib/game-affinity": affinity });
    const result = await service.fetchIgdbDiscovery(1, new AbortController().signal);
    assert.deepEqual(result.games.map(game => game.profile.igdbId), [2, 4]);
    assert.equal(result.games[1].familyId, 2);
    assert.ok(bodies.some(body => body.includes("keywords = (17326)")));
    assert.ok(bodies.some(body => body.includes("where id = (2)")));
    failing = true;
    await assert.rejects(service.fetchIgdbDiscovery(1, new AbortController().signal), /unavailable/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousId === undefined) delete process.env.IGDB_CLIENT_ID; else process.env.IGDB_CLIENT_ID = previousId;
    if (previousSecret === undefined) delete process.env.IGDB_CLIENT_SECRET; else process.env.IGDB_CLIENT_SECRET = previousSecret;
  }
});

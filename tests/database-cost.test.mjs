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
  new Function("require", "exports", outputText)(name => name in mocks ? mocks[name] : name.startsWith("@/") ? {} : require(name), exports);
  return exports;
}
async function withEnv(values, fn) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  try { return await fn(); } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
const authorized = { "@/lib/internal-worker-auth": { hasInternalWorkerAuth: () => true } };
const nextCache = { "next/cache": { revalidatePath: () => undefined } };
function continuationSpy() {
  const calls = [];
  return { calls, module: { continueWorker: (...args) => { calls.push(args); return true; }, readWorkerHop: request => Number(request.headers.get("x-filazo-worker-hop") ?? 0) } };
}

test("scheduled jobs leave the database idle between aligned windows", () => {
  // Neon suspends after five minutes without queries. Any job polling more
  // often than every 30 minutes, or outside the shared windows, keeps it awake.
  const { crons } = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.ok(crons.length > 0);
  for (const { path, schedule } of crons) {
    const [minutes] = schedule.split(" ");
    const values = minutes === "*/30" ? [0, 30] : minutes.split(",").map(Number);
    assert.ok(values.every(Number.isInteger), `${path} uses a fixed minute list: ${schedule}`);
    assert.ok(values.length <= 2, `${path} runs at most twice per hour: ${schedule}`);
    assert.ok(values.every(minute => minute % 30 <= 2), `${path} runs inside a :00/:30 window: ${schedule}`);
  }
});

test("continuation needs the secret and configured app URL, and bounds the chain", async () => {
  const scheduled = [];
  const service = load("../src/lib/worker-continuation.ts", { "next/server": { after: fn => scheduled.push(fn) } });
  await withEnv({ CRON_SECRET: "", APP_URL: "https://filazo.app" }, () => {
    assert.equal(service.continueWorker("steam"), false);
  });
  await withEnv({ CRON_SECRET: "secret", APP_URL: "" }, () => {
    assert.equal(service.continueWorker("steam"), false, "never derives the secret's destination from request headers");
  });
  await withEnv({ CRON_SECRET: "secret", APP_URL: "https://filazo.app" }, () => {
    assert.equal(service.continueWorker("steam", service.MAX_WORKER_HOPS), false);
  });
  assert.equal(scheduled.length, 0);
  assert.equal(service.readWorkerHop(new Request("https://filazo.app", { headers: { [service.WORKER_HOP_HEADER]: "abc" } })), 0);
  assert.equal(service.readWorkerHop(new Request("https://filazo.app", { headers: { [service.WORKER_HOP_HEADER]: "-4" } })), 0);
  assert.equal(service.readWorkerHop(new Request("https://filazo.app", { headers: { [service.WORKER_HOP_HEADER]: "999" } })), service.MAX_WORKER_HOPS);
});

test("continuation starts the next worker invocation after the response", async () => {
  const scheduled = [];
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { requests.push({ url: String(url), init }); return new Response(null, { status: 200 }); };
  try {
    const service = load("../src/lib/worker-continuation.ts", { "next/server": { after: fn => scheduled.push(fn) } });
    await withEnv({ CRON_SECRET: "secret", APP_URL: "https://filazo.app" }, async () => {
      assert.equal(service.continueWorker("metadata", 3), true);
      assert.equal(requests.length, 0, "nothing is sent before the current response finishes");
      await scheduled[0]();
    });
    assert.equal(requests[0].url, "https://filazo.app/api/internal/game-metadata-worker");
    assert.equal(requests[0].init.headers.Authorization, "Bearer secret");
    assert.equal(requests[0].init.headers[service.WORKER_HOP_HEADER], "4");
    assert.equal(requests[0].init.redirect, "manual", "the secret never follows a redirect");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("discovery seeds only library games, without scanning provider JSON, and keeps prepared schedules", async () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const fresh = "2026-11-05T00:00:00.000Z";
  let query; let created;
  const db = {
    game: { findMany: async args => { query = args; return [{ id: "fresh" }, { id: "stale" }, { id: "new" }]; } },
    gameProviderLink: { findMany: async () => [
      { gameId: "fresh", rawData: { gameDiscovery: { refreshAfter: fresh } } },
      { gameId: "stale", rawData: { gameDiscovery: { refreshAfter: "2026-10-01T00:00:00.000Z" } } },
      { gameId: "new", rawData: { igdb: true } },
    ] },
    gameMetadataJob: { createMany: async args => { created = args; } },
  };
  const service = load("../src/lib/game-discovery.ts", { "@/lib/prisma": { prisma: db } });
  await withEnv({ IGDB_CLIENT_ID: "id", IGDB_CLIENT_SECRET: "secret" }, () => service.seedDiscoveryJobs("production:discovery", now));
  assert.deepEqual(query.where.userEntries, { some: {} });
  assert.deepEqual(query.where.metadataJobs, { none: { workerScope: "production:discovery" } });
  assert.equal(query.where.providerLinks, undefined);
  assert.equal(query.select.userEntries, undefined, "seeding reads no personal records");
  assert.equal(created.skipDuplicates, true);
  assert.deepEqual(created.data.map(row => [row.gameId, row.nextAttemptAt.toISOString()]), [
    ["fresh", fresh], ["stale", now.toISOString()], ["new", now.toISOString()],
  ]);
});

test("discovery skips games no longer in any library before calling the provider", async () => {
  let providerCalls = 0;
  const service = load("../src/lib/game-discovery.ts", {
    "@/lib/prisma": { prisma: {
      gameMetadataJob: { count: async () => 1 },
      game: { findUnique: async () => ({ igdbId: 1, userEntries: [] }) },
    } },
    "@/lib/igdb": { fetchIgdbDiscovery: async () => { providerCalls++; return null; } },
  });
  assert.equal(await service.prepareGameDiscovery("source", "production:discovery", "lease", new AbortController().signal), null);
  assert.equal(providerCalls, 0);
});

test("discovery worker reschedules a prepared source instead of deleting its queue row", async () => {
  const refreshAfter = new Date("2026-12-27T00:00:00Z");
  const updates = []; const deletes = [];
  let served = false;
  const db = { gameMetadataJob: {
    findFirst: async () => served ? null : (served = true, { gameId: "game", attempt: 2 }),
    updateMany: async args => { updates.push(args); return { count: 1 }; },
    deleteMany: async args => { deletes.push(args); return { count: 1 }; },
  } };
  const route = load("../src/app/api/internal/game-discovery-worker/route.ts", { ...authorized,
    "@/lib/prisma": { prisma: db },
    "@/lib/steam-sync-state": { getSyncWorkerScope: () => "production" },
    "@/lib/game-discovery": { discoveryWorkerScope: scope => `${scope}:discovery`, seedDiscoveryJobs: async () => undefined, prepareGameDiscovery: async () => ({ refreshAfter }) },
  });
  const response = await withEnv({ IGDB_CLIENT_ID: "id", IGDB_CLIENT_SECRET: "secret" }, () => route.GET(new Request("https://filazo.app/api/internal/game-discovery-worker")));
  assert.equal(response.status, 200);
  assert.equal(deletes.length, 0);
  const reschedule = updates.at(-1);
  assert.equal(reschedule.data.nextAttemptAt, refreshAfter);
  assert.equal(reschedule.data.attempt, 0);
  assert.equal(reschedule.data.workerToken, null);
  assert.ok(reschedule.where.workerToken, "only the lease holder reschedules");
});

for (const [name, path, queueModule, queueExport, worker] of [
  ["Steam", "../src/app/api/internal/steam-sync-worker/route.ts", "@/lib/steam-sync-queue", "steamSyncQueue", "steam"],
  ["PlayStation", "../src/app/api/internal/playstation-sync-worker/route.ts", "@/lib/playstation-sync-queue", "playStationSyncQueue", "playstation"],
]) {
  test(`${name} worker continues due work, then hands imported games to enrichment`, async () => {
    async function run({ worked, due, hop = 0 }) {
      const spy = continuationSpy();
      let recoveries = 0;
      const queue = { drain: async () => worked, hasDueWork: async () => due, recoverInterruptedManualRuns: async () => { recoveries++; } };
      const route = load(path, { ...authorized, ...nextCache, [queueModule]: { [queueExport]: queue }, "@/lib/worker-continuation": spy.module });
      const response = await route.GET(new Request("https://filazo.app/api/internal/worker", { headers: { "x-filazo-worker-hop": String(hop) } }));
      assert.equal(response.status, 200);
      return { calls: spy.calls, recoveries };
    }
    assert.deepEqual((await run({ worked: true, due: true, hop: 4 })).calls, [[worker, 4]]);
    assert.deepEqual((await run({ worked: true, due: false })).calls, [["metadata"]]);
    assert.deepEqual((await run({ worked: false, due: true })).calls, [], "an idle pass never starts a chain");
    if (worker === "playstation") {
      assert.equal((await run({ worked: false, due: false })).recoveries, 1, "scheduled passes run recovery");
      assert.equal((await run({ worked: false, due: false, hop: 2 })).recoveries, 0, "continuations skip recovery");
    }
  });
}

test("metadata worker stops its chain when the queue is empty", async () => {
  const spy = continuationSpy();
  let served = false;
  const db = { gameMetadataJob: {
    findFirst: async () => served ? null : (served = true, { gameId: "game", attempt: 0 }),
    updateMany: async () => ({ count: 1 }),
    deleteMany: async () => ({ count: 1 }),
  } };
  const route = load("../src/app/api/internal/game-metadata-worker/route.ts", { ...authorized,
    "@/lib/prisma": { prisma: db }, "@/lib/catalog": { enrichCatalogGame: async () => undefined },
    "@/lib/steam-sync-state": { getSyncWorkerScope: () => "production" },
    "@/lib/worker-continuation": spy.module,
  });
  assert.equal((await route.GET(new Request("https://filazo.app/api/internal/game-metadata-worker"))).status, 200);
  assert.deepEqual(spy.calls, []);
});

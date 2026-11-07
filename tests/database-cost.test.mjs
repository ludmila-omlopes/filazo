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
function revalidationSpy() {
  const slugs = [];
  return { slugs, module: { revalidateGamePage: slug => slugs.push(slug) } };
}

// Shared worker windows, in UTC (00h, 06h, 12h and 18h in Brasília).
const WINDOW_HOURS = [3, 9, 15, 21];

test("scheduled jobs share four short windows a day so the database can sleep in between", () => {
  // Neon suspends after five minutes without queries. Every job that runs
  // outside the shared windows adds at least five more awake minutes.
  const { crons } = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.ok(crons.length > 0);
  for (const { path, schedule } of crons) {
    const [minute, hour, ...rest] = schedule.split(" ");
    assert.deepEqual(rest, ["*", "*", "*"], `${path} runs every day: ${schedule}`);
    assert.match(minute, /^[0-2]$/, `${path} starts in the first minutes of a window: ${schedule}`);
    const hours = hour.split(",").map(Number);
    assert.ok(hours.length && hours.every(value => WINDOW_HOURS.includes(value)), `${path} runs only in shared windows: ${schedule}`);
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

/** Runs continuations with a fake clock for their waits and records each request. */
async function captureContinuations(run) {
  const scheduled = [];
  const requests = [];
  const delays = [];
  const previousFetch = globalThis.fetch;
  const previousTimeout = globalThis.setTimeout;
  globalThis.fetch = async (url, init) => { requests.push({ url: String(url), init }); return new Response(null, { status: 200 }); };
  globalThis.setTimeout = (fn, ms) => { delays.push(ms); fn(); return 0; };
  try {
    const service = load("../src/lib/worker-continuation.ts", { "next/server": { after: fn => scheduled.push(fn) } });
    await withEnv({ CRON_SECRET: "secret", APP_URL: "https://filazo.app" }, async () => {
      await run(service, requests);
      for (const fn of scheduled) await fn();
    });
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.setTimeout = previousTimeout;
  }
  return { requests, delays, paths: requests.map(request => new URL(request.url).pathname) };
}

test("continuation starts the next worker invocation after the response", async () => {
  const { requests } = await captureContinuations(async (service, sent) => {
    assert.equal(service.continueWorker("metadata", 3), true);
    assert.equal(sent.length, 0, "nothing is sent before the current response finishes");
  });
  assert.equal(requests[0].url, "https://filazo.app/api/internal/game-metadata-worker");
  assert.equal(requests[0].init.headers.Authorization, "Bearer secret");
  assert.equal(requests[0].init.headers["x-filazo-worker-hop"], "4");
  assert.equal(requests[0].init.redirect, "manual", "the secret never follows a redirect");
});

test("sync chains wait for short retries and hand finished imports to enrichment", async () => {
  const queue = dueIn => ({ calls: 0, async nextDueIn() { this.calls++; return dueIn; } });

  const idleCron = queue(0);
  assert.deepEqual((await captureContinuations(service => service.continueSyncQueue("steam", idleCron, { worked: false }))).paths, []);
  assert.equal(idleCron.calls, 0, "an idle scheduled pass reads nothing and starts nothing");

  assert.deepEqual((await captureContinuations(service => service.continueSyncQueue("steam", queue(0), { worked: true, hop: 2, startedAt: Date.now() }))).paths,
    ["/api/internal/steam-sync-worker"], "due work continues");
  assert.deepEqual((await captureContinuations(service => service.continueSyncQueue("playstation", queue(null), { worked: true }))).paths,
    ["/api/internal/game-metadata-worker"], "a finished import starts enrichment");
  assert.deepEqual((await captureContinuations(service => service.continueSyncQueue("steam", queue(60 * 60_000), { worked: true }))).paths,
    ["/api/internal/game-metadata-worker"], "a long provider backoff waits for the next window");
  assert.deepEqual((await captureContinuations(service => service.continueSyncQueue("steam", queue(null), { worked: false, hop: 3 }))).paths,
    [], "a finished chain stops");

  const retry = await captureContinuations(service => service.continueSyncQueue("steam", queue(30_000), { worked: true, startedAt: Date.now() }));
  assert.deepEqual(retry.paths, ["/api/internal/steam-sync-worker"]);
  assert.equal(retry.delays[0], 30_000, "a 30-second retry is followed after exactly that wait");

  const later = await captureContinuations(service => service.continueSyncQueue("playstation", queue(2 * 60_000), { worked: false, hop: 4, startedAt: Date.now() }));
  assert.deepEqual(later.paths, ["/api/internal/playstation-sync-worker"], "an idle hop keeps waiting for a soon-due retry");
  assert.ok(later.delays[0] <= 40_000 && later.delays[0] > 30_000, "each hop waits within its own time budget");

  const fromAction = await captureContinuations(service => service.continueSyncQueue("steam", queue(90_000), { worked: true }));
  assert.deepEqual(fromAction.delays, [], "without a time budget the next hop starts at once and does the waiting");
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
      game: { findUnique: async () => ({ igdbId: 1, slug: "source", userEntries: [] }) },
    } },
    "@/lib/igdb": { fetchIgdbDiscovery: async () => { providerCalls++; return null; } },
  });
  assert.equal(await service.prepareGameDiscovery("source", "production:discovery", "lease", new AbortController().signal), null);
  assert.equal(providerCalls, 0);
});

test("discovery worker reschedules a prepared source and refreshes its public page", async () => {
  const refreshAfter = new Date("2026-12-27T00:00:00Z");
  const updates = []; const deletes = [];
  const pages = revalidationSpy();
  let served = false;
  const db = { gameMetadataJob: {
    findFirst: async () => served ? null : (served = true, { gameId: "game", attempt: 2 }),
    updateMany: async args => { updates.push(args); return { count: 1 }; },
    deleteMany: async args => { deletes.push(args); return { count: 1 }; },
  } };
  const route = load("../src/app/api/internal/game-discovery-worker/route.ts", { ...authorized,
    "@/lib/prisma": { prisma: db },
    "@/lib/public-game-cache": pages.module,
    "@/lib/steam-sync-state": { getSyncWorkerScope: () => "production" },
    "@/lib/game-discovery": { discoveryWorkerScope: scope => `${scope}:discovery`, seedDiscoveryJobs: async () => undefined, prepareGameDiscovery: async () => ({ refreshAfter, slug: "elden-ring" }) },
  });
  const response = await withEnv({ IGDB_CLIENT_ID: "id", IGDB_CLIENT_SECRET: "secret" }, () => route.GET(new Request("https://filazo.app/api/internal/game-discovery-worker")));
  assert.equal(response.status, 200);
  assert.equal(deletes.length, 0);
  const reschedule = updates.at(-1);
  assert.equal(reschedule.data.nextAttemptAt, refreshAfter);
  assert.equal(reschedule.data.attempt, 0);
  assert.equal(reschedule.data.workerToken, null);
  assert.ok(reschedule.where.workerToken, "only the lease holder reschedules");
  assert.deepEqual(pages.slugs, ["elden-ring"], "visitors see the new related games");
});

for (const [name, path, queueModule, queueExport, worker] of [
  ["Steam", "../src/app/api/internal/steam-sync-worker/route.ts", "@/lib/steam-sync-queue", "steamSyncQueue", "steam"],
  ["PlayStation", "../src/app/api/internal/playstation-sync-worker/route.ts", "@/lib/playstation-sync-queue", "playStationSyncQueue", "playstation"],
]) {
  test(`${name} worker hands every pass to the shared continuation rules`, async () => {
    async function run({ worked, hop = 0 }) {
      const calls = [];
      let recoveries = 0;
      const queue = { drain: async () => worked, nextDueIn: async () => 0, recoverInterruptedManualRuns: async () => { recoveries++; } };
      const route = load(path, { ...authorized, ...nextCache, [queueModule]: { [queueExport]: queue },
        "@/lib/worker-continuation": {
          readWorkerHop: request => Number(request.headers.get("x-filazo-worker-hop") ?? 0),
          continueSyncQueue: async (target, used, options) => { calls.push({ target, same: used === queue, ...options }); },
        },
      });
      const response = await route.GET(new Request("https://filazo.app/api/internal/worker", { headers: { "x-filazo-worker-hop": String(hop) } }));
      assert.equal(response.status, 200);
      return { calls, recoveries };
    }
    const { calls } = await run({ worked: true, hop: 4 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].target, worker);
    assert.equal(calls[0].same, true);
    assert.equal(calls[0].worked, true);
    assert.equal(calls[0].hop, 4);
    assert.equal(typeof calls[0].startedAt, "number", "the worker passes its time budget for waits");
    assert.equal((await run({ worked: false })).calls[0].worked, false);
    if (worker === "playstation") {
      assert.equal((await run({ worked: false })).recoveries, 1, "scheduled passes run recovery");
      assert.equal((await run({ worked: false, hop: 2 })).recoveries, 0, "continuations skip recovery");
    }
  });
}

test("metadata worker refreshes enriched pages and stops its chain when the queue is empty", async () => {
  const continued = [];
  const pages = revalidationSpy();
  let served = false;
  const db = { gameMetadataJob: {
    findFirst: async () => served ? null : (served = true, { gameId: "game", attempt: 0 }),
    updateMany: async () => ({ count: 1 }),
    deleteMany: async () => ({ count: 1 }),
  } };
  const route = load("../src/app/api/internal/game-metadata-worker/route.ts", { ...authorized,
    "@/lib/prisma": { prisma: db }, "@/lib/catalog": { enrichCatalogGame: async () => "elden-ring" },
    "@/lib/public-game-cache": pages.module,
    "@/lib/steam-sync-state": { getSyncWorkerScope: () => "production" },
    "@/lib/worker-continuation": { continueWorker: (...args) => continued.push(args), readWorkerHop: () => 0 },
  });
  assert.equal((await route.GET(new Request("https://filazo.app/api/internal/game-metadata-worker"))).status, 200);
  assert.deepEqual(continued, []);
  assert.deepEqual(pages.slugs, ["elden-ring"]);
});

test("robots.txt turns away commercial crawlers but keeps search engines and assistants", () => {
  const robots = load("../src/app/robots.ts", { "@/lib/site-metadata": { getSiteUrl: () => new URL("https://filazo.app") } }).default();
  const blocked = robots.rules.find(rule => rule.disallow === "/");
  for (const crawler of ["PetalBot", "SemrushBot", "AhrefsBot", "Amazonbot", "meta-externalagent", "ExaSearchBot", "Bytespider"]) {
    assert.ok(blocked.userAgent.includes(crawler), `${crawler} is blocked`);
  }
  for (const crawler of ["Googlebot", "bingbot", "OAI-SearchBot", "ClaudeBot", "DuckDuckBot", "facebookexternalhit"]) {
    assert.ok(!blocked.userAgent.includes(crawler), `${crawler} stays allowed`);
  }
  const everyone = robots.rules.find(rule => rule.userAgent === "*");
  assert.equal(everyone.allow, "/");
  assert.ok(everyone.disallow.includes("/profile"));
  assert.equal(robots.sitemap, "https://filazo.app/sitemap.xml");
});

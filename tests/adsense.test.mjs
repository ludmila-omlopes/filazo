import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";
import * as adsense from "../src/lib/adsense.ts";

const { getAdSenseConfig, getAdSensePublisherId, getAdsTxt, getViewerAdSenseConfig } = adsense;
const env = {
  NODE_ENV: "production", VERCEL_ENV: "production", ADSENSE_ENABLED: "true",
  ADSENSE_PUBLISHER_ID: "ca-pub-1234567890123456",
  ADSENSE_LIBRARY_SLOT_ID: "1234567890", ADSENSE_GAME_SLOT_ID: "0987654321",
};
const config = getAdSenseConfig("library", env);
const now = new Date("2026-09-14T12:00:00Z");
const paid = { status: "active", livemode: true, paidThrough: new Date("2026-10-01T00:00:00Z") };

test("ads are opt-in and malformed/incomplete configuration cannot load a provider", () => {
  assert.equal(getAdSenseConfig("library", {}), null);
  for (const patch of [
    { ADSENSE_ENABLED: "false" }, { ADSENSE_ENABLED: "1" },
    { ADSENSE_PUBLISHER_ID: "pub-1234567890123456" },
    { ADSENSE_PUBLISHER_ID: "ca-pub-1234567890123456&unexpected=1" },
    { ADSENSE_LIBRARY_SLOT_ID: "" }, { ADSENSE_LIBRARY_SLOT_ID: "bad/slot" },
  ]) assert.equal(getAdSenseConfig("library", { ...env, ...patch }), null);
  assert.equal(getAdSenseConfig("game", { ...env, ADSENSE_LIBRARY_SLOT_ID: "" }).slotId, env.ADSENSE_GAME_SLOT_ID);
});

test("only production can serve live ads; explicit test mode also works there", () => {
  assert.equal(config.testMode, false);
  for (const patch of [
    { NODE_ENV: "development" }, { NODE_ENV: "test" },
    { VERCEL_ENV: "preview" }, { VERCEL_ENV: "development" }, { ADSENSE_TEST_MODE: "true" },
  ]) assert.equal(getAdSenseConfig("library", { ...env, ...patch }).testMode, true);
});

test("ads.txt verifies ownership without activating banners and rejects injected entries", () => {
  assert.equal(getAdsTxt({ ...env, ADSENSE_ENABLED: "false" }), "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
  assert.equal(getAdsTxt({}), null);
  assert.equal(getAdSensePublisherId({ ADSENSE_PUBLISHER_ID: `${env.ADSENSE_PUBLISHER_ID}\nmalicious.com, pub-1` }), null);
});

test("disabled ads and signed-out visitors do not query accounts", async () => {
  const never = async () => { assert.fail("unexpected account query"); };
  assert.equal(await getViewerAdSenseConfig(null, "viewer", never), null);
  assert.equal(await getViewerAdSenseConfig(config, null, never), config);
});

test("manual and paid Pro, including canceled renewal and paid past-due time, never receive ads", async () => {
  for (const account of [
    { plan: "PRO", billingSubscriptions: [] },
    { plan: "FREE", billingSubscriptions: [paid] },
    { plan: "FREE", billingSubscriptions: [{ ...paid, cancelAtPeriodEnd: true }] },
    { plan: "FREE", billingSubscriptions: [{ ...paid, status: "past_due" }] },
  ]) assert.equal(await getViewerAdSenseConfig(config, "viewer", async () => account, now, true), null);
});

test("free, expired and wrong-environment subscriptions receive ads using the existing billing rules", async () => {
  for (const subscriptions of [
    [], [{ ...paid, paidThrough: now }], [{ ...paid, paidThrough: null }],
    [{ ...paid, livemode: false }], [{ ...paid, status: "canceled" }],
  ]) assert.equal(await getViewerAdSenseConfig(config, "viewer", async (id) => {
    assert.equal(id, "viewer");
    return { plan: "FREE", billingSubscriptions: subscriptions };
  }, now, true), config);
});

test("unknown entitlements fail closed, including missing subscription projections and database outages", async () => {
  for (const account of [null, { plan: "FREE" }]) {
    assert.equal(await getViewerAdSenseConfig(config, "viewer", async () => account), null);
  }
  assert.equal(await getViewerAdSenseConfig(config, "viewer", async () => { throw Error("offline"); }), null);
});

const require = createRequire(import.meta.url);
function loadModule(relativePath, mocks) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  new Function("require", "exports", outputText)((name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) throw Error(`Unmocked dependency ${name}`);
    return require(name);
  }, exports);
  return exports;
}

test("banner checks the authenticated viewer with a private bounded projection before including the client loader", async () => {
  let account = { plan: "PRO", billingSubscriptions: [] };
  const { AdSenseBanner } = loadModule("../src/components/adsense-banner.tsx", {
    "@/components/adsense-slot": { AdSenseSlot: "ad-slot" },
    "@/lib/adsense": { ...adsense, getAdSenseConfig: () => config },
    "@/lib/session": { getSessionUserId: async () => "authenticated-viewer" },
    "@/lib/i18n": { createTranslator: () => () => "Publicidade" },
    "@/lib/prisma": { prisma: { user: { findUnique: async (query) => {
      assert.deepEqual(query.where, { id: "authenticated-viewer" });
      assert.deepEqual(query.select, {
        plan: true, billingSubscriptions: { select: { status: true, paidThrough: true, livemode: true } },
      });
      return account;
    } } } },
  });
  assert.equal(await AdSenseBanner({ placement: "game", locale: "pt-BR" }), null);
  account = { plan: "FREE", billingSubscriptions: [] };
  const rendered = await AdSenseBanner({ placement: "game", locale: "pt-BR" });
  assert.equal(rendered.type, "ad-slot");
  assert.equal(rendered.props.label, "Publicidade");
  account = null;
  assert.equal(await AdSenseBanner({ placement: "game", locale: "pt-BR" }), null);
});

test("ads.txt responds as plain text and stays unavailable without a configured publisher", async () => {
  let body = null;
  const { GET } = loadModule("../src/app/ads.txt/route.ts", {
    "@/lib/adsense": { getAdsTxt: () => body },
  });
  assert.equal(GET().status, 404);
  body = getAdsTxt(env);
  const response = GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/plain; charset=utf-8");
  assert.equal(await response.text(), body);
});

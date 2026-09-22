import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";
import * as policy from "../src/lib/catalog-upload-policy.ts";
import * as fileTypes from "../src/lib/upload-file-type.ts";
import * as requestBody from "../src/lib/request-body.ts";
import { ABUSE_LIMITS } from "../src/lib/abuse-policy.ts";
import * as storage from "../src/lib/upload-storage.ts";

const require = createRequire(import.meta.url);
function load(relative, mocks) {
  const source = readFileSync(new URL(relative, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  new Function("require", "exports", outputText)(name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/") || name.startsWith("./")) throw new Error(`Unmocked ${name}`);
    return require(name);
  }, exports);
  return exports;
}
const pathname = "imports/user-a/12345678-1234-4234-8234-123456789abc.png";
const payload = { pathname, fileName: "photo.png" };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII=", "base64");
function media(blob) {
  return load("../src/lib/catalog-upload.ts", { "@vercel/blob": blob, "./catalog-upload-policy": policy, "./upload-file-type": fileTypes });
}
function stream(bytes) { return new Blob([bytes]).stream(); }

test("catalog uploads reject foreign accounts, URLs, traversal and duplicate references", () => {
  assert.equal(policy.canUploadCatalogPath(pathname, "user-a"), true);
  for (const path of [pathname.replace("user-a", "user-b"), `https://example.com/${pathname}`, pathname.replace("user-a", "user-a/.."), pathname + "/x", pathname.replace(".png", ".svg")]) {
    assert.equal(policy.canUploadCatalogPath(path, "user-a"), false);
  }
  assert.equal(policy.catalogUploadsSchema.safeParse([payload, payload]).success, false);
});

test("CSV limit counts UTF-8 bytes and reserves space for encoded form fields", () => {
  assert.equal(policy.csvFits("a".repeat(policy.CSV_MAX_BYTES)), true);
  assert.equal(policy.csvFits("á".repeat(policy.CSV_MAX_BYTES / 2 + 1)), false);
  assert.equal(policy.csvFits("a".repeat(policy.CSV_MAX_BYTES + 1)), false);
  const body = new URLSearchParams({ csvText: "&".repeat(policy.CSV_MAX_BYTES), mapping: "a".repeat(16384), fileName: "a.csv" }).toString();
  assert.ok(Buffer.byteLength(body) < 4 * 1024 * 1024);
});

test("foreign photo reference is refused before any storage read", async () => {
  const service = media({ head() { assert.fail("must not read foreign object"); } });
  await assert.rejects(service.resolveCatalogUpload(payload, "user-b", 1024), /path/);
});

test("photo metadata enforces configured size and MIME before downloading", async () => {
  for (const metadata of [{ size: 1025, contentType: "image/png" }, { size: 0, contentType: "image/png" }, { size: 100, contentType: "text/html" }, { size: 100, contentType: "image/jpeg" }]) {
    const service = media({ head: async () => metadata, get() { assert.fail("must not download invalid object"); } });
    await assert.rejects(service.resolveCatalogUpload(payload, "user-a", 1024), /size or format/);
  }
});

test("private photo is resolved from storage and keeps its audit URL", async () => {
  const service = media({
    head: async () => ({ size: png.length, contentType: "image/png" }),
    get: async (path, options) => { assert.equal(path, pathname); assert.deepEqual(options, { access: "private", useCache: false }); return { stream: stream(png) }; },
  });
  const result = await service.resolveCatalogUpload(payload, "user-a", 1024);
  assert.equal(result.url, `/uploads/${pathname}`);
  assert.deepEqual(Buffer.from(await result.file.arrayBuffer()), png);
});

test("spoofed image and overlong object stream are refused", async () => {
  const fake = Buffer.from("<html>not an image</html>");
  const service = media({ head: async () => ({ size: fake.length, contentType: "image/png" }), get: async () => ({ stream: stream(fake) }) });
  await assert.rejects(service.resolveCatalogUpload(payload, "user-a", 1024), /contents/);
  let canceled = false;
  const long = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(2048)); }, cancel() { canceled = true; } });
  await assert.rejects(service.readBoundedImage(long, 1024), /too large/);
  assert.equal(canceled, true);
});

function tokenRoute({ user = "user-a", limit = null } = {}) {
  const issued = [];
  const route = load("../src/app/api/catalog/upload/route.ts", {
    "@vercel/blob/client": { handleUpload: async ({ body, onBeforeGenerateToken }) => { issued.push(await onBeforeGenerateToken(body.payload.pathname, body.payload.clientPayload)); return { ok: true }; } },
    "@/lib/session": { getSessionUserId: async () => user },
    "@/lib/ai-settings": { getAiSettings: async () => ({ photoImportEnabled: true, photoImportMaxFileBytes: 4194304 }) },
    "@/lib/openai": { isAiProviderConfigured: () => true },
    "@/lib/abuse-policy": { ABUSE_LIMITS },
    "@/lib/abuse-request": { checkApiAbuse: async policies => policies[0] === ABUSE_LIMITS.uploadDaily ? limit : null },
    "@/lib/request-body": requestBody,
    "@/lib/catalog-upload-policy": policy,
    "@/lib/upload-file-type": fileTypes,
  });
  return { ...route, issued };
}
function request(ref = payload) {
  return new Request("https://filazo.test/api/catalog/upload", { method: "POST", body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname: ref.pathname, clientPayload: JSON.stringify(ref) } }) });
}

test("token endpoint requires login, validates owner and limits the request body", async () => {
  assert.equal((await tokenRoute({ user: null }).POST(request())).status, 401);
  const route = tokenRoute();
  assert.equal((await route.POST(request({ ...payload, pathname: pathname.replace("user-a", "user-b") }))).status, 400);
  assert.equal((await route.POST(new Request("https://filazo.test", { method: "POST", body: "x".repeat(17000) }))).status, 413);
  assert.equal(route.issued.length, 0);
});

test("token is short-lived, cannot overwrite files and respects upload quota", async () => {
  const route = tokenRoute();
  assert.equal((await route.POST(request())).status, 200);
  const [options] = route.issued;
  assert.equal(options.maximumSizeInBytes, 4194304);
  assert.equal(options.allowOverwrite, false);
  assert.ok(options.validUntil <= Date.now() + 300000);
  assert.equal((await tokenRoute({ limit: new Response(null, { status: 429 }) }).POST(request())).status, 429);
});

test("audit photo route only streams the owner's private Blob", async () => {
  let reads = 0;
  let user = "user-b";
  const route = load("../src/app/uploads/[...path]/route.ts", {
    "@vercel/blob": { get: async path => { reads++; assert.equal(path, pathname); return { stream: stream(png) }; } },
    "@/lib/session": { getSessionUserId: async () => user },
    "@/lib/catalog-upload-policy": policy,
    "@/lib/journal-media": {}, "@/lib/upload-storage": storage, "@/lib/prisma": {},
  });
  const params = { params: Promise.resolve({ path: pathname.split("/") }) };
  assert.equal((await route.GET(new Request("https://filazo.test"), params)).status, 404);
  user = null;
  assert.equal((await route.GET(new Request("https://filazo.test"), params)).status, 404);
  assert.equal(reads, 0);
  user = "user-a";
  const response = await route.GET(new Request("https://filazo.test"), params);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
});

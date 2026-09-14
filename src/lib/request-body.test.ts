import assert from "node:assert/strict";
import test from "node:test";
import { readLimitedJson, RequestBodyError } from "./request-body.ts";

const request = (body: string, headers?: HeadersInit) => new Request("http://localhost", { method: "POST", body, headers });
test("JSON limit counts actual UTF-8 bytes even without or with a false Content-Length", async () => {
  assert.deepEqual(await readLimitedJson(request('{"ok":true}'), 20), { ok: true });
  for (const headers of [undefined, { "content-length": "1" }]) {
    await assert.rejects(readLimitedJson(request('"ééééé"', headers), 10), (error: unknown) => error instanceof RequestBodyError && error.status === 413);
  }
  await assert.rejects(readLimitedJson(request("{"), 10), (error: unknown) => error instanceof RequestBodyError && error.status === 400);
});

test("oversized streaming bodies are cancelled before being completely buffered", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(8)); },
    cancel() { cancelled = true; },
  });
  const input = new Request("http://localhost", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  await assert.rejects(readLimitedJson(input, 10), { status: 413 });
  assert.equal(cancelled, true);
});

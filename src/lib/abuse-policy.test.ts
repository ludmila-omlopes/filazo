import assert from "node:assert/strict";
import test from "node:test";
import { getClientNetwork } from "./abuse-policy.ts";
import { journalUploadMaxBytes, JOURNAL_IMAGE_MAX_BYTES } from "./journal-upload-limits.ts";

test("client-controlled forwarded headers do not select an identity outside a trusted ingress", () => {
  const headers = new Headers({ "x-forwarded-for": "1.2.3.4", "x-vercel-forwarded-for": "5.6.7.8" });
  assert.equal(getClientNetwork(headers, {}), "unknown-network");
  assert.equal(getClientNetwork(headers, { VERCEL: "1" }), "5.6.7.8");
  assert.equal(getClientNetwork(headers, { RATE_LIMIT_TRUSTED_IP_HEADER: "x-forwarded-for" }), "1.2.3.4");
  headers.set("x-vercel-forwarded-for", "1.2.3.4, 5.6.7.8");
  assert.equal(getClientNetwork(headers, { VERCEL: "1" }), "unknown-network");
});

test("IPv6 aliases and privacy addresses share the same /64 quota", () => {
  const network = (ip: string) => getClientNetwork(new Headers({ "x-vercel-forwarded-for": ip }), { VERCEL: "1" });
  assert.equal(network("2001:db8:0:1::1"), network("2001:0DB8:0000:0001:ffff:ffff:ffff:ffff"));
  assert.notEqual(network("2001:db8:0:1::1"), network("2001:db8:0:2::1"));
  assert.equal(network("::ffff:192.0.2.1"), network("192.0.2.1"));
  assert.equal(network("::ffff:c000:201"), network("192.0.2.1"));
});

test("image limit is always present independently of the configured audio limit", () => {
  assert.equal(journalUploadMaxBytes("image", 50_000_000), JOURNAL_IMAGE_MAX_BYTES);
  assert.equal(journalUploadMaxBytes("audio", 5_000_000), 5_000_000);
});

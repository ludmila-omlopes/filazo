import assert from "node:assert/strict";
import { test } from "node:test";
import { securityHeaders } from "../src/lib/security-headers.ts";

const header = (key) => securityHeaders.find((entry) => entry.key === key)?.value;

test("pages cannot be framed by other sites", () => {
  assert.match(header("Content-Security-Policy"), /frame-ancestors 'none'/);
  assert.equal(header("X-Frame-Options"), "DENY");
});

test("the baseline CSP never restricts scripts, styles or images", () => {
  // Those need per-request nonces; adding them here would break rendering.
  assert.doesNotMatch(header("Content-Security-Policy"), /default-src|script-src|style-src|img-src|connect-src/);
});

test("voice and photo capture stay available only to this site", () => {
  const policy = header("Permissions-Policy");
  assert.match(policy, /microphone=\(self\)/);
  assert.match(policy, /camera=\(self\)/);
  assert.match(policy, /geolocation=\(\)/);
});

test("HSTS is left to the hosting platform", () => {
  assert.equal(header("Strict-Transport-Security"), undefined);
});

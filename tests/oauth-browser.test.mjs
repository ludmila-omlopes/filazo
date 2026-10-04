import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getSafeOAuthReturnPath,
  getSessionClearRedirectPath,
  isGoogleOAuthBlockedUserAgent,
} from "../src/lib/oauth-browser.ts";

test("Google OAuth blocks common embedded browser user agents", () => {
  assert.equal(isGoogleOAuthBlockedUserAgent("Threads 360.0 iPhone"), true);
  assert.equal(
    isGoogleOAuthBlockedUserAgent(
      "Mozilla/5.0 (Linux; Android 15; Pixel 9 Build/AP3A; wv) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36 Instagram 345.0.0.0",
    ),
    true,
  );
  assert.equal(
    isGoogleOAuthBlockedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    ),
    true,
  );
});

test("Google OAuth allows regular mobile browsers", () => {
  assert.equal(
    isGoogleOAuthBlockedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1",
    ),
    false,
  );
  assert.equal(
    isGoogleOAuthBlockedUserAgent(
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36",
    ),
    false,
  );
});

test("OAuth return paths stay inside known auth surfaces", () => {
  assert.equal(getSafeOAuthReturnPath("/admin", "/profile"), "/admin");
  assert.equal(getSafeOAuthReturnPath("/login?auth=1", "/profile"), "/login?auth=1");
  assert.equal(getSafeOAuthReturnPath("/profile", "/profile"), "/profile");
  assert.equal(getSafeOAuthReturnPath("https://evil.example", "/profile"), "/profile");
  assert.equal(getSafeOAuthReturnPath("//evil.example", "/profile"), "/profile");
});

test("clearing a session keeps the existing in-app redirects", () => {
  assert.equal(getSessionClearRedirectPath("/login", "expired"), "/login?auth=1&expired=1");
  assert.equal(getSessionClearRedirectPath("/profile?tab=library", null), "/profile?tab=library");
  assert.equal(getSessionClearRedirectPath(null, null), "/login");
  assert.equal(getSessionClearRedirectPath(null, "expired"), "/login?auth=1&expired=1");
});

test("clearing a session never redirects off the site", () => {
  for (const next of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
  ]) {
    assert.equal(getSessionClearRedirectPath(next, null), "/login", next);
    assert.equal(getSessionClearRedirectPath(next, "expired"), "/login?auth=1&expired=1", next);
  }
});

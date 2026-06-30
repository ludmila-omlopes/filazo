import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getSafeOAuthReturnPath,
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
  assert.equal(getSafeOAuthReturnPath("/admin", "/beta"), "/admin");
  assert.equal(getSafeOAuthReturnPath("/login?auth=1", "/beta"), "/login?auth=1");
  assert.equal(getSafeOAuthReturnPath("/profile", "/beta"), "/beta");
  assert.equal(getSafeOAuthReturnPath("https://evil.example", "/beta"), "/beta");
  assert.equal(getSafeOAuthReturnPath("//evil.example", "/beta"), "/beta");
});

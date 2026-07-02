import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getAuthSecret } from "./auth-secret.ts";

const env = process.env as Record<string, string | undefined>;
const originalAuthSecret = env["AUTH_SECRET"];
const originalNodeEnv = env["NODE_ENV"];

afterEach(() => {
  if (originalAuthSecret === undefined) {
    delete env["AUTH_SECRET"];
  } else {
    env["AUTH_SECRET"] = originalAuthSecret;
  }

  if (originalNodeEnv === undefined) {
    delete env["NODE_ENV"];
  } else {
    env["NODE_ENV"] = originalNodeEnv;
  }
});

test("returns the configured auth secret when it is long enough", () => {
  env["NODE_ENV"] = "production";
  env["AUTH_SECRET"] = "a-long-random-secret";

  assert.equal(getAuthSecret(), "a-long-random-secret");
});

test("returns the development fallback outside production", () => {
  env["NODE_ENV"] = "test";
  delete env["AUTH_SECRET"];

  assert.equal(getAuthSecret(), ["local", "dev", "secret", "change", "me"].join("-"));
});

test("throws in production when auth secret is missing", () => {
  env["NODE_ENV"] = "production";
  delete env["AUTH_SECRET"];

  assert.throws(() => getAuthSecret(), /AUTH_SECRET is not configured/);
});

test("throws in production when auth secret is too short", () => {
  env["NODE_ENV"] = "production";
  env["AUTH_SECRET"] = "abc";

  assert.throws(() => getAuthSecret(), /AUTH_SECRET is not configured/);
});

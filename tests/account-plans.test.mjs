import assert from "node:assert/strict";
import { test } from "node:test";
import { assertProAccess, hasProAccess, ProRequiredError } from "../src/lib/account-plans.ts";

test("only an explicit Pro plan grants access", () => {
  assert.equal(hasProAccess({ plan: "PRO" }), true);
  for (const user of [null, undefined, {}, { plan: "FREE" }, { plan: "pro" }, { plan: "ADMIN" }]) {
    assert.equal(hasProAccess(user), false);
    assert.throws(() => assertProAccess(user), (error) =>
      error instanceof ProRequiredError && error.code === "PRO_REQUIRED");
  }
});

test("admin and approved beta accounts do not implicitly get Pro", () => {
  const user = { plan: "FREE", email: "ludmila.omlopes@gmail.com", betaApplication: { status: "APPROVED" } };
  assert.throws(() => assertProAccess(user), ProRequiredError);
});

test("granting and revoking Pro changes access immediately", () => {
  const user = { plan: "FREE" };
  assert.throws(() => assertProAccess(user), ProRequiredError);
  user.plan = "PRO";
  assert.doesNotThrow(() => assertProAccess(user));
  user.plan = "FREE";
  assert.throws(() => assertProAccess(user), ProRequiredError);
});

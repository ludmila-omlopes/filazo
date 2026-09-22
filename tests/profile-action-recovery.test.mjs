import assert from "node:assert/strict";
import { test } from "node:test";
import { createProfileActionRunner } from "../src/lib/profile-action-runner.ts";

function fixture() {
  const pending = [];
  let failure = null;
  const runner = createProfileActionRunner({
    onPending: value => pending.push(value),
    onFailure: value => { failure = value; },
  });
  return { runner, pending, get failure() { return failure; } };
}

test("rapid clicks cannot start a second request, even before React re-renders", async () => {
  const state = fixture();
  let release;
  let requests = 0;
  const first = state.runner.run(async () => {
    requests++;
    await new Promise(resolve => { release = resolve; });
  });
  assert.equal(state.runner.busy, true);
  assert.equal(await state.runner.run(async () => { requests++; }), false);
  assert.equal(requests, 1);
  release();
  assert.equal(await first, true);
  assert.equal(state.runner.busy, false);
  assert.deepEqual(state.pending, [true, false]);
});

for (const message of ["An unexpected response was received from the server.", "Failed to fetch", "Unexpected server error"]) {
  test(`rejected action is handled and only retried by an explicit call: ${message}`, async () => {
    const state = fixture();
    const error = new Error(message);
    const formData = new FormData();
    formData.set("slot1EntryId", "chosen-game");
    const sent = [];
    const operation = async () => {
      sent.push(formData.get("slot1EntryId"));
      if (sent.length === 1) throw error;
    };
    assert.equal(await state.runner.run(operation), false);
    assert.equal(state.failure.error, error);
    assert.equal(state.failure.retry, operation);
    assert.equal(state.runner.busy, false);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.deepEqual(sent, ["chosen-game"]);
    assert.equal(formData.get("slot1EntryId"), "chosen-game");
    assert.equal(await state.runner.run(state.failure.retry), true);
    assert.deepEqual(sent, ["chosen-game", "chosen-game"]);
    assert.equal(state.failure, null);
    assert.deepEqual(state.pending, [true, false, true, false]);
  });
}

test("an acknowledged validation error stays with the form, not the transport recovery", async () => {
  const state = fixture();
  let formError;
  await state.runner.run(async () => {
    const result = { ok: false, message: "Choose a game" };
    if (!result.ok) formError = result.message;
  });
  assert.equal(formError, "Choose a game");
  assert.equal(state.failure, null);
});

test("a new explicit selection replaces the failed attempt instead of replaying stale data", async () => {
  const state = fixture();
  let oldCalls = 0;
  await state.runner.run(async () => { oldCalls++; throw new Error("offline"); });
  let newCalls = 0;
  await state.runner.run(async () => { newCalls++; });
  assert.equal(oldCalls, 1);
  assert.equal(newCalls, 1);
  assert.equal(state.failure, null);
});

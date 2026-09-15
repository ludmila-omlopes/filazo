import assert from "node:assert/strict";
import test from "node:test";
import { applyPlanAiLimits, canAddJournalMedia, getPlanLimits } from "./plan-policy.ts";
import { billingLiveMode } from "./billing-policy.ts";

test("free, paid, expired and manual access share the same feature policy", () => {
  const free = getPlanLimits({ plan: "FREE" });
  const manual = getPlanLimits({ plan: "PRO" });
  const paid = getPlanLimits({ plan: "FREE", billingSubscriptions: [{ status: "active", livemode: billingLiveMode(), paidThrough: new Date(Date.now() + 60000) }] });
  const expired = getPlanLimits({ plan: "FREE", billingSubscriptions: [{ status: "active", livemode: billingLiveMode(), paidThrough: new Date(Date.now() - 60000) }] });
  for (const feature of ["calendar", "automaticSync", "webSearch", "retrospective"] as const) {
    assert.equal(free[feature], false);
    assert.equal(expired[feature], false);
    assert.equal(manual[feature], true);
    assert.equal(paid[feature], true);
  }
  assert.ok(manual.journalStorageBytes > free.journalStorageBytes);
  assert.ok(manual.chatDailyTokenLimit > free.chatDailyTokenLimit);
  assert.ok(manual.voiceTranscriptionDailyCallLimit > free.voiceTranscriptionDailyCallLimit);
});

test("AI plan quotas never override administrator ceilings or disabled allowances", () => {
  const disabled = { chatDailyTokenLimit: 0, voiceTranscriptionDailyCallLimit: 0 };
  assert.deepEqual(applyPlanAiLimits(disabled, { plan: "PRO" }), disabled);
  const small = { chatDailyTokenLimit: 15, voiceTranscriptionDailyCallLimit: 1 };
  assert.deepEqual(applyPlanAiLimits(small, { plan: "PRO" }), small);
  const generous = { chatDailyTokenLimit: 100000, voiceTranscriptionDailyCallLimit: 100 };
  assert.ok(applyPlanAiLimits(generous, { plan: "FREE" }).chatDailyTokenLimit < applyPlanAiLimits(generous, { plan: "PRO" }).chatDailyTokenLimit);
});

test("storage limits accept exact capacity and preserve text after downgrade", () => {
  assert.equal(canAddJournalMedia(80, 20, 100), true);
  assert.equal(canAddJournalMedia(80, 21, 100), false);
  assert.equal(canAddJournalMedia(1000, 0, 100), true);
  assert.equal(canAddJournalMedia(1000, 1, 100), false);
  assert.equal(canAddJournalMedia(80, -20, 100), false);
  assert.equal(canAddJournalMedia(80, NaN, 100), false);
});

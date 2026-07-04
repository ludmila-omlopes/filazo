import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getAiBudgetCountedStatuses,
  getAiBudgetLimitFailure,
  getBudgetUsageFromRun,
} from "../src/lib/ai-budget.ts";

function emptyUsage() {
  return {
    calls: 0,
    files: 0,
    tokens: 0,
    usd: 0,
  };
}

function usage(overrides = {}) {
  return {
    daily: emptyUsage(),
    dailyByFeature: new Map(),
    weekly: emptyUsage(),
    weeklyByFeature: new Map(),
    ...overrides,
  };
}

const settings = {
  assistantPlayNextDailyTokenLimit: 100,
  chatDailyTokenLimit: 100,
  photoImportDailyCallLimit: 2,
  photoImportDailyFileLimit: 4,
  playerProfileWeeklyCallLimit: 1,
  userDailySpendLimitUsd: 0.1,
  voiceTranscriptionDailyCallLimit: 2,
};

test("AI budget counted statuses include reserved, used, and failed runs", () => {
  assert.deepEqual(getAiBudgetCountedStatuses(), [
    "AI_BUDGET_RESERVED",
    "AI_BUDGET_USED",
    "AI_BUDGET_FAILED",
  ]);
});

test("AI budget usage prefers actual output usage over estimates", () => {
  const result = getBudgetUsageFromRun({
    inputSummary: {
      kind: "ai_budget",
      feature: "assistant_chat",
      countedCalls: 1,
      countedFiles: 0,
      estimatedUsage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        usd: 0.01,
      },
    },
    outputSummary: {
      output: {
        usage: {
          inputTokens: 25,
          outputTokens: 35,
          totalTokens: 60,
        },
      },
    },
  });

  assert.equal(result?.feature, "assistant_chat");
  assert.equal(result?.tokens, 60);
  assert.notEqual(result?.usd, 0.01);
});

test("AI budget spend limit fails before reservation", () => {
  const result = getAiBudgetLimitFailure({
    countedCalls: 1,
    countedFiles: 0,
    estimatedTokens: 1,
    estimatedUsd: 0.02,
    feature: "assistant_chat",
    settings,
    usage: usage({ daily: { calls: 0, files: 0, tokens: 0, usd: 0.09 } }),
  });

  assert.equal(result?.allowed, false);
  assert.equal(result?.reason, "USER_DAILY_SPEND_LIMIT");
});

test("AI budget token and call limits include pending reservation estimates", () => {
  const chatResult = getAiBudgetLimitFailure({
    countedCalls: 1,
    countedFiles: 0,
    estimatedTokens: 15,
    estimatedUsd: 0,
    feature: "assistant_chat",
    settings,
    usage: usage({
      dailyByFeature: new Map([
        ["assistant_chat", { calls: 1, files: 0, tokens: 90, usd: 0 }],
      ]),
    }),
  });
  const profileResult = getAiBudgetLimitFailure({
    countedCalls: 1,
    countedFiles: 0,
    estimatedTokens: 1,
    estimatedUsd: 0,
    feature: "player_profile",
    settings,
    usage: usage({
      weeklyByFeature: new Map([
        ["player_profile", { calls: 1, files: 0, tokens: 10, usd: 0 }],
      ]),
    }),
  });

  assert.equal(chatResult?.reason, "FEATURE_DAILY_TOKEN_LIMIT");
  assert.equal(profileResult?.reason, "FEATURE_WEEKLY_CALL_LIMIT");
});

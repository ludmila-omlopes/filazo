import assert from "node:assert/strict";
import { test } from "node:test";
import { UserGameStatus } from "@prisma/client";
import {
  estimateRemainingTime,
  isEntryFinished,
} from "../src/lib/time-estimates.ts";

test("remaining time ignores achievement progress when playtime is available", () => {
  const estimate = estimateRemainingTime(
    createEntry({
      completionPercent: 25,
      playtimeMinutes: 180,
      hltbMainExtraMinutes: 1200,
    }),
  );

  assert.equal(estimate?.remainingMinutes, 1020);
  assert.equal(estimate?.basis, "playtime");
  assert.equal(estimate?.targetLabel, "main + extras");
});

test("remaining time falls back to playtime against HLTB target", () => {
  const estimate = estimateRemainingTime(
    createEntry({
      playtimeMinutes: 180,
      hltbMainStoryMinutes: 600,
    }),
  );

  assert.equal(estimate?.remainingMinutes, 420);
  assert.equal(estimate?.basis, "playtime");
  assert.equal(estimate?.targetLabel, "main story");
});

test("completed entries have no remaining time", () => {
  const estimate = estimateRemainingTime(
    createEntry({
      status: UserGameStatus.COMPLETED,
      playtimeMinutes: 60,
      hltbMainStoryMinutes: 600,
    }),
  );

  assert.equal(estimate?.remainingMinutes, 0);
  assert.equal(estimate?.basis, "completed");
});

test("missing HLTB data returns no estimate", () => {
  assert.equal(estimateRemainingTime(createEntry({})), null);
});

test("entries with finishedAt have no remaining time", () => {
  const estimate = estimateRemainingTime(
    createEntry({
      finishedAt: new Date("2026-01-01"),
      playtimeMinutes: 60,
      hltbMainStoryMinutes: 600,
    }),
  );

  assert.equal(estimate?.remainingMinutes, 0);
  assert.equal(estimate?.basis, "completed");
});

test("100% achievements alone does not mean finished", () => {
  const entry = createEntry({
    completionPercent: 100,
    hltbMainExtraMinutes: 1200,
  });

  assert.equal(isEntryFinished(entry), false);

  const estimate = estimateRemainingTime(entry);
  assert.equal(estimate?.basis, "full-estimate");
  assert.equal(estimate?.remainingMinutes, 1200);
});

test("isEntryFinished accepts COMPLETED status or finishedAt", () => {
  assert.equal(
    isEntryFinished(createEntry({ status: UserGameStatus.COMPLETED })),
    true,
  );
  assert.equal(
    isEntryFinished(createEntry({ finishedAt: new Date() })),
    true,
  );
  assert.equal(isEntryFinished(createEntry({})), false);
});

function createEntry({
  status = UserGameStatus.OWNED,
  playtimeMinutes = null,
  completionPercent = null,
  finishedAt = null,
  hltbMainStoryMinutes = null,
  hltbMainExtraMinutes = null,
  hltbCompletionistMinutes = null,
}) {
  return {
    status,
    playtimeMinutes,
    completionPercent,
    finishedAt,
    game: {
      hltbMainStoryMinutes,
      hltbMainExtraMinutes,
      hltbCompletionistMinutes,
    },
  };
}

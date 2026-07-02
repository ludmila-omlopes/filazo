import assert from "node:assert/strict";
import { test } from "node:test";
import { UserGameStatus } from "@prisma/client";
import {
  estimateRemainingTime,
  isEntryFinished,
} from "./time-estimates.ts";

test("isEntryFinished accepts completed status or finishedAt", () => {
  assert.equal(isEntryFinished(createEntry({ status: UserGameStatus.COMPLETED })), true);
  assert.equal(isEntryFinished(createEntry({ finishedAt: new Date() })), true);
  assert.equal(isEntryFinished(createEntry({ status: UserGameStatus.PLAYING })), false);
});

test("estimateRemainingTime returns null when no HLTB target exists", () => {
  assert.equal(estimateRemainingTime(createEntry({})), null);
});

test("estimateRemainingTime chooses the default target in preference order", () => {
  assert.deepEqual(
    estimateRemainingTime(
      createEntry({
        hltbMainStoryMinutes: 80,
        hltbMainExtraMinutes: 100,
        hltbCompletionistMinutes: 200,
      }),
    )?.targetLabel,
    "main + extras",
  );
  assert.equal(
    estimateRemainingTime(createEntry({ hltbMainStoryMinutes: 80 }))?.targetLabel,
    "main story",
  );
  assert.equal(
    estimateRemainingTime(createEntry({ hltbCompletionistMinutes: 200 }))
      ?.targetLabel,
    "completionist",
  );
});

test("estimateRemainingTime returns zero for finished entries", () => {
  const estimate = estimateRemainingTime(
    createEntry({
      status: UserGameStatus.COMPLETED,
      hltbMainStoryMinutes: 100,
    }),
  );

  assert.equal(estimate?.remainingMinutes, 0);
  assert.equal(estimate?.basis, "completed");
});

test("estimateRemainingTime uses completion percent before playtime", () => {
  const estimate = estimateRemainingTime(
    createEntry({
      completionPercent: 25,
      playtimeMinutes: 50,
      hltbMainStoryMinutes: 100,
    }),
  );

  assert.equal(estimate?.remainingMinutes, 75);
  assert.equal(estimate?.basis, "completion-percent");
});

test("estimateRemainingTime treats zero completion percent as tracked progress", () => {
  const estimate = estimateRemainingTime(
    createEntry({
      completionPercent: 0,
      hltbMainStoryMinutes: 100,
    }),
  );

  assert.equal(estimate?.remainingMinutes, 100);
  assert.equal(estimate?.basis, "completion-percent");
});

test("estimateRemainingTime falls back to playtime with a zero floor", () => {
  const partial = estimateRemainingTime(
    createEntry({
      playtimeMinutes: 30,
      hltbMainStoryMinutes: 100,
    }),
  );
  const overTarget = estimateRemainingTime(
    createEntry({
      playtimeMinutes: 150,
      hltbMainStoryMinutes: 100,
    }),
  );

  assert.equal(partial?.remainingMinutes, 70);
  assert.equal(partial?.basis, "playtime");
  assert.equal(overTarget?.remainingMinutes, 0);
});

test("estimateRemainingTime returns the full estimate with no progress", () => {
  const estimate = estimateRemainingTime(
    createEntry({
      hltbMainStoryMinutes: 100,
    }),
  );

  assert.equal(estimate?.remainingMinutes, 100);
  assert.equal(estimate?.basis, "full-estimate");
});

function createEntry({
  status = UserGameStatus.OWNED,
  playtimeMinutes = null,
  completionPercent = null,
  finishedAt = null,
  hltbMainStoryMinutes = null,
  hltbMainExtraMinutes = null,
  hltbCompletionistMinutes = null,
}: {
  status?: UserGameStatus;
  playtimeMinutes?: number | null;
  completionPercent?: number | null;
  finishedAt?: Date | null;
  hltbMainStoryMinutes?: number | null;
  hltbMainExtraMinutes?: number | null;
  hltbCompletionistMinutes?: number | null;
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

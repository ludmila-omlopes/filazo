import assert from "node:assert/strict";
import test from "node:test";
import { FeedbackStatus } from "@prisma/client";
import { isFeedbackClosed } from "./feedback.ts";

test("feedback conversations stay open until done or declined", () => {
  assert.equal(isFeedbackClosed(FeedbackStatus.NEW), false);
  assert.equal(isFeedbackClosed(FeedbackStatus.IN_REVIEW), false);
  assert.equal(isFeedbackClosed(FeedbackStatus.WAITING), false);
  assert.equal(isFeedbackClosed(FeedbackStatus.DONE), true);
  assert.equal(isFeedbackClosed(FeedbackStatus.DECLINED), true);
});

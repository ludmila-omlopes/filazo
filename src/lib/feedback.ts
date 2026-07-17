import { FeedbackStatus, FeedbackType } from "@prisma/client";
import type { TranslationKey } from "@/lib/i18n";

export const FEEDBACK_STATUS_ORDER = [
  FeedbackStatus.NEW,
  FeedbackStatus.IN_REVIEW,
  FeedbackStatus.DONE,
  FeedbackStatus.DECLINED,
] as const;

export const FEEDBACK_STATUS_LABEL_KEYS: Record<FeedbackStatus, TranslationKey> =
  {
    [FeedbackStatus.NEW]: "feedback.status.new",
    [FeedbackStatus.IN_REVIEW]: "feedback.status.inReview",
    [FeedbackStatus.DONE]: "feedback.status.done",
    [FeedbackStatus.DECLINED]: "feedback.status.declined",
  };

export const FEEDBACK_TYPE_LABEL_KEYS: Record<FeedbackType, TranslationKey> = {
  [FeedbackType.IMPROVEMENT]: "feedback.type.improvement",
  [FeedbackType.BUG]: "feedback.type.bug",
};

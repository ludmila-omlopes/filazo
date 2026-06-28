import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.ts";
import { getAiSettings, isAiFeatureEnabled } from "./ai-settings.ts";

export type AiBudgetFeature =
  | "assistant_chat"
  | "assistant_play_next"
  | "assistant_summary"
  | "photo_import"
  | "player_profile"
  | "story_completion"
  | "voice_transcription"
  | "voice_translation";

type AiBudgetReservation = {
  ids: string[];
  feature: AiBudgetFeature;
  groupId: string;
  model: string | null;
  units: number;
  userId: string;
};

type AiBudgetReserveResult =
  | {
      allowed: true;
      reservation: AiBudgetReservation;
    }
  | {
      allowed: false;
      message: string;
      reason: "FEATURE_DISABLED" | "USER_DAILY_LIMIT" | "GLOBAL_DAILY_LIMIT";
    };

const AI_BUDGET_WINDOW_MS = 24 * 60 * 60 * 1000;
const AI_BUDGET_COUNTED_STATUSES = [
  "AI_BUDGET_RESERVED",
  "AI_BUDGET_USED",
  "AI_BUDGET_FAILED",
] as const;

export class AiBudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiBudgetExceededError";
  }
}

export async function getAiBudgetLimits() {
  const settings = await getAiSettings();
  return {
    userDailyLimit: settings.userDailyLimit,
    globalDailyLimit: settings.globalDailyLimit,
  };
}

function getWindowStart(now: Date) {
  return new Date(now.getTime() - AI_BUDGET_WINDOW_MS);
}

function getCountedStatusFilter() {
  return { in: [...AI_BUDGET_COUNTED_STATUSES] };
}

function isSerializableConflict(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2034"
  );
}

export async function getAiBudgetUsageForUser(userId: string, now = new Date()) {
  const limits = await getAiBudgetLimits();
  const oneDayAgo = getWindowStart(now);
  const [userUsedToday, globalUsedToday] = await Promise.all([
    prisma.assistantRun.count({
      where: {
        userId,
        status: getCountedStatusFilter(),
        createdAt: { gte: oneDayAgo },
      },
    }),
    prisma.assistantRun.count({
      where: {
        status: getCountedStatusFilter(),
        createdAt: { gte: oneDayAgo },
      },
    }),
  ]);
  const userRemainingToday = Math.max(
    0,
    limits.userDailyLimit - userUsedToday,
  );
  const globalRemainingToday = Math.max(
    0,
    limits.globalDailyLimit - globalUsedToday,
  );

  return {
    ...limits,
    userUsedToday,
    globalUsedToday,
    userRemainingToday,
    globalRemainingToday,
    effectiveRemainingToday: Math.min(userRemainingToday, globalRemainingToday),
  };
}

async function reserveAiBudgetOnce({
  feature,
  inputSummary,
  model,
  now,
  units,
  userId,
}: {
  feature: AiBudgetFeature;
  inputSummary?: Prisma.InputJsonValue;
  model?: string | null;
  now: Date;
  units: number;
  userId: string;
}): Promise<AiBudgetReserveResult> {
  const settings = await getAiSettings();
  if (!isAiFeatureEnabled(settings, feature)) {
    return {
      allowed: false,
      reason: "FEATURE_DISABLED",
      message: "This AI feature is disabled in admin settings.",
    };
  }

  const limits = {
    userDailyLimit: settings.userDailyLimit,
    globalDailyLimit: settings.globalDailyLimit,
  };
  const oneDayAgo = getWindowStart(now);

  return prisma.$transaction(
    async (tx) => {
      const [userUsedToday, globalUsedToday] = await Promise.all([
        tx.assistantRun.count({
          where: {
            userId,
            status: getCountedStatusFilter(),
            createdAt: { gte: oneDayAgo },
          },
        }),
        tx.assistantRun.count({
          where: {
            status: getCountedStatusFilter(),
            createdAt: { gte: oneDayAgo },
          },
        }),
      ]);

      if (userUsedToday + units > limits.userDailyLimit) {
        return {
          allowed: false as const,
          reason: "USER_DAILY_LIMIT" as const,
          message: `Daily AI budget reached (${limits.userDailyLimit} units per user per day). Try again tomorrow.`,
        };
      }

      if (globalUsedToday + units > limits.globalDailyLimit) {
        return {
          allowed: false as const,
          reason: "GLOBAL_DAILY_LIMIT" as const,
          message: "The app-wide AI budget for today is used up. Try again tomorrow.",
        };
      }

      const groupId = crypto.randomUUID();
      const ids: string[] = [];
      for (let unit = 1; unit <= units; unit += 1) {
        const run = await tx.assistantRun.create({
          data: {
            userId,
            inputSummary: {
              kind: "ai_budget",
              feature,
              groupId,
              input: inputSummary ?? null,
              reservedUnits: units,
              unit,
            } as Prisma.InputJsonValue,
            outputSummary: {
              kind: "ai_budget",
              feature,
              groupId,
              state: "reserved",
            } as Prisma.InputJsonValue,
            model: model ?? null,
            status: "AI_BUDGET_RESERVED",
          },
          select: {
            id: true,
          },
        });
        ids.push(run.id);
      }

      return {
        allowed: true as const,
        reservation: {
          ids,
          feature,
          groupId,
          model: model ?? null,
          units,
          userId,
        },
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function reserveAiBudget({
  feature,
  inputSummary,
  model,
  now = new Date(),
  units = 1,
  userId,
}: {
  feature: AiBudgetFeature;
  inputSummary?: Prisma.InputJsonValue;
  model?: string | null;
  now?: Date;
  units?: number;
  userId: string;
}) {
  const normalizedUnits = Math.max(1, Math.floor(units));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await reserveAiBudgetOnce({
        feature,
        inputSummary,
        model,
        now,
        units: normalizedUnits,
        userId,
      });
    } catch (error) {
      if (isSerializableConflict(error) && attempt < 2) {
        continue;
      }
      throw error;
    }
  }

  return reserveAiBudgetOnce({
    feature,
    inputSummary,
    model,
    now,
    units: normalizedUnits,
    userId,
  });
}

export async function markAiBudgetUsed(
  reservation: AiBudgetReservation,
  outputSummary?: Prisma.InputJsonValue,
) {
  await prisma.assistantRun.updateMany({
    where: {
      id: { in: reservation.ids },
      status: "AI_BUDGET_RESERVED",
    },
    data: {
      status: "AI_BUDGET_USED",
      outputSummary: {
        kind: "ai_budget",
        feature: reservation.feature,
        groupId: reservation.groupId,
        state: "used",
        output: outputSummary ?? null,
      } as Prisma.InputJsonValue,
    },
  });
}

export async function markAiBudgetFailed(
  reservation: AiBudgetReservation,
  error: unknown,
) {
  await prisma.assistantRun.updateMany({
    where: {
      id: { in: reservation.ids },
      status: "AI_BUDGET_RESERVED",
    },
    data: {
      status: "AI_BUDGET_FAILED",
      outputSummary: {
        kind: "ai_budget",
        feature: reservation.feature,
        groupId: reservation.groupId,
        state: "failed",
        error: error instanceof Error ? error.message : "AI request failed.",
      } as Prisma.InputJsonValue,
    },
  });
}

export async function runWithAiBudget<T>({
  execute,
  feature,
  inputSummary,
  model,
  units,
  userId,
}: {
  execute: () => Promise<T>;
  feature: AiBudgetFeature;
  inputSummary?: Prisma.InputJsonValue;
  model?: string | null;
  units?: number;
  userId: string;
}) {
  const budget = await reserveAiBudget({
    feature,
    inputSummary,
    model,
    units,
    userId,
  });
  if (!budget.allowed) {
    throw new AiBudgetExceededError(budget.message);
  }

  try {
    const result = await execute();
    await markAiBudgetUsed(budget.reservation);
    return result;
  } catch (error) {
    await markAiBudgetFailed(budget.reservation, error);
    throw error;
  }
}

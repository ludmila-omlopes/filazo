import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.ts";
import {
  estimateAiCostUsd,
  getAiEstimateConfig,
} from "./ai-estimates.ts";
import {
  AI_SETTINGS_ID,
  getAiSettings,
  isAiFeatureEnabled,
  normalizeAiSettings,
  type AiSettingsValues,
} from "./ai-settings.ts";

export type AiBudgetFeature =
  | "assistant_chat"
  | "assistant_play_next"
  | "assistant_summary"
  | "photo_import"
  | "player_profile"
  | "story_completion"
  | "voice_transcription";

type AiBudgetReservation = {
  countedCalls: number;
  countedFiles: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTokens: number;
  estimatedUsd: number;
  feature: AiBudgetFeature;
  groupId: string;
  id: string;
  model: string | null;
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
      reason:
        | "FEATURE_DISABLED"
        | "USER_DAILY_SPEND_LIMIT"
        | "FEATURE_DAILY_TOKEN_LIMIT"
        | "FEATURE_DAILY_CALL_LIMIT"
        | "FEATURE_DAILY_FILE_LIMIT"
        | "FEATURE_WEEKLY_CALL_LIMIT";
    };

type BudgetUsage = {
  calls: number;
  files: number;
  tokens: number;
  usd: number;
};

type BudgetUsageSummary = {
  daily: BudgetUsage;
  dailyByFeature: Map<AiBudgetFeature, BudgetUsage>;
  weekly: BudgetUsage;
  weeklyByFeature: Map<AiBudgetFeature, BudgetUsage>;
};

type AiBudgetPrismaClient = Pick<typeof prisma, "aiSettings" | "assistantRun">;

type AiBudgetLimitSettings = Pick<
  AiSettingsValues,
  | "assistantPlayNextDailyTokenLimit"
  | "chatDailyTokenLimit"
  | "photoImportDailyCallLimit"
  | "photoImportDailyFileLimit"
  | "playerProfileWeeklyCallLimit"
  | "userDailySpendLimitUsd"
  | "voiceTranscriptionDailyCallLimit"
>;

const AI_BUDGET_DAY_MS = 24 * 60 * 60 * 1000;
const AI_BUDGET_WEEK_MS = 7 * AI_BUDGET_DAY_MS;
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

function getWindowStart(now: Date, windowMs: number) {
  return new Date(now.getTime() - windowMs);
}

export function getAiBudgetCountedStatuses() {
  return [...AI_BUDGET_COUNTED_STATUSES];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readFeature(value: unknown): AiBudgetFeature | null {
  switch (value) {
    case "assistant_chat":
    case "assistant_play_next":
    case "assistant_summary":
    case "photo_import":
    case "player_profile":
    case "story_completion":
    case "voice_transcription":
      return value;
    default:
      return null;
  }
}

function readUsageFromOutput(outputSummary: unknown) {
  if (!isRecord(outputSummary)) {
    return null;
  }

  const directInputTokens = readNumber(outputSummary.inputTokens);
  const directOutputTokens = readNumber(outputSummary.outputTokens);
  const directTotalTokens = readNumber(outputSummary.totalTokens);
  if (directInputTokens || directOutputTokens || directTotalTokens) {
    return {
      inputTokens: directInputTokens,
      outputTokens: directOutputTokens,
      totalTokens: directTotalTokens || directInputTokens + directOutputTokens,
    };
  }

  if (isRecord(outputSummary.usage)) {
    const inputTokens = readNumber(outputSummary.usage.inputTokens);
    const outputTokens = readNumber(outputSummary.usage.outputTokens);
    const totalTokens = readNumber(outputSummary.usage.totalTokens);
    return {
      inputTokens,
      outputTokens,
      totalTokens: totalTokens || inputTokens + outputTokens,
    };
  }

  return null;
}

export function getBudgetUsageFromRun(run: {
  inputSummary: Prisma.JsonValue;
  outputSummary: Prisma.JsonValue;
}) {
  const inputSummary = isRecord(run.inputSummary) ? run.inputSummary : null;
  if (inputSummary?.kind !== "ai_budget") {
    return null;
  }

  const feature = readFeature(inputSummary.feature);
  if (!feature) {
    return null;
  }

  const estimatedUsage = isRecord(inputSummary.estimatedUsage)
    ? inputSummary.estimatedUsage
    : null;
  const outputSummary = isRecord(run.outputSummary) ? run.outputSummary : null;
  const actualUsage = outputSummary
    ? readUsageFromOutput(outputSummary.output)
    : null;
  const estimatedInputTokens = readNumber(estimatedUsage?.inputTokens);
  const estimatedOutputTokens = readNumber(estimatedUsage?.outputTokens);
  const estimatedTokens =
    readNumber(estimatedUsage?.totalTokens) ||
    estimatedInputTokens + estimatedOutputTokens;
  const actualTokens = actualUsage?.totalTokens ?? 0;
  const inputTokens = actualUsage?.inputTokens ?? estimatedInputTokens;
  const outputTokens = actualUsage?.outputTokens ?? estimatedOutputTokens;
  const tokens = actualTokens || estimatedTokens;
  const config = getAiEstimateConfig();
  const usd = actualUsage
    ? estimateAiCostUsd({
        config,
        inputTokens,
        outputTokens,
      })
    : readNumber(estimatedUsage?.usd);

  return {
    calls: Math.max(0, readNumber(inputSummary.countedCalls)),
    feature,
    files: Math.max(0, readNumber(inputSummary.countedFiles)),
    tokens: Math.max(0, tokens),
    usd: Math.max(0, usd),
  };
}

function addUsage(target: BudgetUsage, usage: BudgetUsage) {
  target.calls += usage.calls;
  target.files += usage.files;
  target.tokens += usage.tokens;
  target.usd += usage.usd;
}

function emptyUsage(): BudgetUsage {
  return {
    calls: 0,
    files: 0,
    tokens: 0,
    usd: 0,
  };
}

async function getBudgetUsage({
  client = prisma,
  now,
  userId,
}: {
  client?: AiBudgetPrismaClient;
  now: Date;
  userId: string;
}): Promise<BudgetUsageSummary> {
  const weekStart = getWindowStart(now, AI_BUDGET_WEEK_MS);
  const dayStart = getWindowStart(now, AI_BUDGET_DAY_MS);
  const runs = await client.assistantRun.findMany({
    where: {
      userId,
      status: getCountedStatusFilter(),
      createdAt: { gte: weekStart },
    },
    select: {
      createdAt: true,
      inputSummary: true,
      outputSummary: true,
    },
  });
  const daily = emptyUsage();
  const weekly = emptyUsage();
  const dailyByFeature = new Map<AiBudgetFeature, BudgetUsage>();
  const weeklyByFeature = new Map<AiBudgetFeature, BudgetUsage>();

  for (const run of runs) {
    const usage = getBudgetUsageFromRun(run);
    if (!usage) {
      continue;
    }

    const budgetUsage = {
      calls: usage.calls,
      files: usage.files,
      tokens: usage.tokens,
      usd: usage.usd,
    };
    addUsage(weekly, budgetUsage);
    addUsage(
      weeklyByFeature.get(usage.feature) ?? weeklyByFeature.set(usage.feature, emptyUsage()).get(usage.feature)!,
      budgetUsage,
    );

    if (run.createdAt >= dayStart) {
      addUsage(daily, budgetUsage);
      addUsage(
        dailyByFeature.get(usage.feature) ?? dailyByFeature.set(usage.feature, emptyUsage()).get(usage.feature)!,
        budgetUsage,
      );
    }
  }

  return {
    daily,
    dailyByFeature,
    weekly,
    weeklyByFeature,
  };
}

async function getAiSettingsWithClient(client: AiBudgetPrismaClient) {
  const settings = await client.aiSettings.findUnique({
    where: { id: AI_SETTINGS_ID },
  });

  return normalizeAiSettings(settings);
}

export async function getAiBudgetUsageForUser(userId: string, now = new Date()) {
  const [settings, usage] = await Promise.all([
    getAiSettings(),
    getBudgetUsage({ now, userId }),
  ]);
  const chatUsage = usage.dailyByFeature.get("assistant_chat") ?? emptyUsage();
  const playNextUsage =
    usage.dailyByFeature.get("assistant_play_next") ?? emptyUsage();
  const profileWeeklyUsage =
    usage.weeklyByFeature.get("player_profile") ?? emptyUsage();
  const photoUsage = usage.dailyByFeature.get("photo_import") ?? emptyUsage();
  const voiceUsage =
    usage.dailyByFeature.get("voice_transcription") ?? emptyUsage();
  const spendRemainingToday = Math.max(
    0,
    settings.userDailySpendLimitUsd - usage.daily.usd,
  );
  const chatRemainingTokens = Math.max(
    0,
    settings.chatDailyTokenLimit - chatUsage.tokens,
  );
  const playNextRemainingTokens = Math.max(
    0,
    settings.assistantPlayNextDailyTokenLimit - playNextUsage.tokens,
  );

  return {
    assistantPlayNextDailyTokenLimit:
      settings.assistantPlayNextDailyTokenLimit,
    assistantPlayNextRemainingTokensToday: playNextRemainingTokens,
    assistantPlayNextTokensUsedToday: playNextUsage.tokens,
    chatDailyTokenLimit: settings.chatDailyTokenLimit,
    chatRemainingTokensToday: chatRemainingTokens,
    chatTokensUsedToday: chatUsage.tokens,
    effectiveRemainingToday: Math.floor(
      Math.min(spendRemainingToday * 1000, chatRemainingTokens),
    ),
    photoImportCallsRemainingToday: Math.max(
      0,
      settings.photoImportDailyCallLimit - photoUsage.calls,
    ),
    photoImportCallsUsedToday: photoUsage.calls,
    photoImportDailyCallLimit: settings.photoImportDailyCallLimit,
    photoImportDailyFileLimit: settings.photoImportDailyFileLimit,
    photoImportFilesRemainingToday: Math.max(
      0,
      settings.photoImportDailyFileLimit - photoUsage.files,
    ),
    photoImportFilesUsedToday: photoUsage.files,
    playerProfileCallsRemainingThisWeek: Math.max(
      0,
      settings.playerProfileWeeklyCallLimit - profileWeeklyUsage.calls,
    ),
    playerProfileCallsUsedThisWeek: profileWeeklyUsage.calls,
    playerProfileWeeklyCallLimit: settings.playerProfileWeeklyCallLimit,
    spendRemainingToday,
    spendUsedToday: usage.daily.usd,
    userDailySpendLimitUsd: settings.userDailySpendLimitUsd,
    userDailyLimit: settings.userDailySpendLimitUsd,
    userRemainingToday: spendRemainingToday,
    userUsedToday: usage.daily.usd,
    globalDailyLimit: settings.userDailySpendLimitUsd,
    globalRemainingToday: spendRemainingToday,
    voiceTranscriptionCallsRemainingToday: Math.max(
      0,
      settings.voiceTranscriptionDailyCallLimit - voiceUsage.calls,
    ),
    voiceTranscriptionCallsUsedToday: voiceUsage.calls,
    voiceTranscriptionDailyCallLimit:
      settings.voiceTranscriptionDailyCallLimit,
  };
}

function getFeatureLimitFailure({
  feature,
  settings,
  usage,
  estimatedTokens,
  countedCalls,
  countedFiles,
}: {
  feature: AiBudgetFeature;
  settings: AiBudgetLimitSettings;
  usage: BudgetUsageSummary;
  estimatedTokens: number;
  countedCalls: number;
  countedFiles: number;
}): AiBudgetReserveResult | null {
  const dailyFeature = usage.dailyByFeature.get(feature) ?? emptyUsage();
  const weeklyFeature = usage.weeklyByFeature.get(feature) ?? emptyUsage();

  if (
    feature === "assistant_chat" &&
    dailyFeature.tokens + estimatedTokens > settings.chatDailyTokenLimit
  ) {
    return {
      allowed: false,
      reason: "FEATURE_DAILY_TOKEN_LIMIT",
      message: "Daily library chat token limit reached. Try again tomorrow.",
    };
  }

  if (
    feature === "assistant_play_next" &&
    dailyFeature.tokens + estimatedTokens >
      settings.assistantPlayNextDailyTokenLimit
  ) {
    return {
      allowed: false,
      reason: "FEATURE_DAILY_TOKEN_LIMIT",
      message:
        "Daily play-next recommendation token limit reached. Try again tomorrow.",
    };
  }

  if (
    feature === "player_profile" &&
    weeklyFeature.calls + countedCalls > settings.playerProfileWeeklyCallLimit
  ) {
    return {
      allowed: false,
      reason: "FEATURE_WEEKLY_CALL_LIMIT",
      message:
        "Weekly player profile AI limit reached. Try again next week.",
    };
  }

  if (
    feature === "photo_import" &&
    dailyFeature.calls + countedCalls > settings.photoImportDailyCallLimit
  ) {
    return {
      allowed: false,
      reason: "FEATURE_DAILY_CALL_LIMIT",
      message: "Daily photo import AI call limit reached. Try again tomorrow.",
    };
  }

  if (
    feature === "photo_import" &&
    dailyFeature.files + countedFiles > settings.photoImportDailyFileLimit
  ) {
    return {
      allowed: false,
      reason: "FEATURE_DAILY_FILE_LIMIT",
      message: "Daily photo import image limit reached. Try again tomorrow.",
    };
  }

  if (
    feature === "voice_transcription" &&
    dailyFeature.calls + countedCalls >
      settings.voiceTranscriptionDailyCallLimit
  ) {
    return {
      allowed: false,
      reason: "FEATURE_DAILY_CALL_LIMIT",
      message: "Daily voice transcription limit reached. Try again tomorrow.",
    };
  }

  return null;
}

export function getAiBudgetLimitFailure({
  countedCalls,
  countedFiles,
  estimatedTokens,
  estimatedUsd,
  feature,
  settings,
  usage,
}: {
  countedCalls: number;
  countedFiles: number;
  estimatedTokens: number;
  estimatedUsd: number;
  feature: AiBudgetFeature;
  settings: AiBudgetLimitSettings;
  usage: BudgetUsageSummary;
}): AiBudgetReserveResult | null {
  if (usage.daily.usd + estimatedUsd > settings.userDailySpendLimitUsd) {
    return {
      allowed: false,
      reason: "USER_DAILY_SPEND_LIMIT",
      message: "Daily personal AI spend limit reached. Try again tomorrow.",
    };
  }

  return getFeatureLimitFailure({
    feature,
    settings,
    usage,
    estimatedTokens,
    countedCalls,
    countedFiles,
  });
}

async function reserveAiBudgetOnce({
  countedCalls,
  countedFiles,
  estimatedInputTokens,
  estimatedOutputTokens,
  feature,
  inputSummary,
  model,
  now,
  userId,
}: {
  countedCalls: number;
  countedFiles: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  feature: AiBudgetFeature;
  inputSummary?: Prisma.InputJsonValue;
  model?: string | null;
  now: Date;
  userId: string;
}): Promise<AiBudgetReserveResult> {
  const estimatedTokens = estimatedInputTokens + estimatedOutputTokens;
  const estimatedUsd = estimateAiCostUsd({
    inputTokens: estimatedInputTokens,
    outputTokens: estimatedOutputTokens,
  });

  return prisma.$transaction(
    async (tx) => {
      const client = tx as AiBudgetPrismaClient;
      const settings = await getAiSettingsWithClient(client);
      if (!isAiFeatureEnabled(settings, feature)) {
        return {
          allowed: false,
          reason: "FEATURE_DISABLED",
          message: "This AI feature is disabled in admin settings.",
        };
      }

      const usage = await getBudgetUsage({ client, now, userId });
      const limitFailure = getAiBudgetLimitFailure({
        feature,
        settings,
        usage,
        estimatedTokens,
        estimatedUsd,
        countedCalls,
        countedFiles,
      });
      if (limitFailure) {
        return limitFailure;
      }

      const groupId = crypto.randomUUID();
      const run = await client.assistantRun.create({
        data: {
          userId,
          inputSummary: {
            kind: "ai_budget",
            feature,
            groupId,
            input: inputSummary ?? null,
            countedCalls,
            countedFiles,
            estimatedUsage: {
              inputTokens: estimatedInputTokens,
              outputTokens: estimatedOutputTokens,
              totalTokens: estimatedTokens,
              usd: estimatedUsd,
            },
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

      return {
        allowed: true as const,
        reservation: {
          countedCalls,
          countedFiles,
          estimatedInputTokens,
          estimatedOutputTokens,
          estimatedTokens,
          estimatedUsd,
          feature,
          groupId,
          id: run.id,
          model: model ?? null,
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
  countedCalls = 1,
  countedFiles = 0,
  estimatedInputTokens,
  estimatedOutputTokens,
  feature,
  inputSummary,
  model,
  now = new Date(),
  userId,
}: {
  countedCalls?: number;
  countedFiles?: number;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  feature: AiBudgetFeature;
  inputSummary?: Prisma.InputJsonValue;
  model?: string | null;
  now?: Date;
  userId: string;
}) {
  const config = getAiEstimateConfig();
  const normalizedInputTokens = Math.max(
    0,
    Math.ceil(estimatedInputTokens ?? config.inputTokensPerCall),
  );
  const normalizedOutputTokens = Math.max(
    0,
    Math.ceil(estimatedOutputTokens ?? 0),
  );
  const normalizedCalls = Math.max(0, Math.ceil(countedCalls));
  const normalizedFiles = Math.max(0, Math.ceil(countedFiles));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await reserveAiBudgetOnce({
        countedCalls: normalizedCalls,
        countedFiles: normalizedFiles,
        estimatedInputTokens: normalizedInputTokens,
        estimatedOutputTokens: normalizedOutputTokens,
        feature,
        inputSummary,
        model,
        now,
        userId,
      });
    } catch (error) {
      if (isSerializableConflict(error) && attempt < 2) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not reserve AI budget after retrying transaction conflicts.");
}

export async function markAiBudgetUsed(
  reservation: AiBudgetReservation,
  outputSummary?: Prisma.InputJsonValue,
) {
  await prisma.assistantRun.updateMany({
    where: {
      id: reservation.id,
      status: "AI_BUDGET_RESERVED",
    },
    data: {
      status: "AI_BUDGET_USED",
      outputSummary: {
        kind: "ai_budget",
        feature: reservation.feature,
        groupId: reservation.groupId,
        state: "used",
        estimatedUsage: {
          inputTokens: reservation.estimatedInputTokens,
          outputTokens: reservation.estimatedOutputTokens,
          totalTokens: reservation.estimatedTokens,
          usd: reservation.estimatedUsd,
        },
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
      id: reservation.id,
      status: "AI_BUDGET_RESERVED",
    },
    data: {
      status: "AI_BUDGET_FAILED",
      outputSummary: {
        kind: "ai_budget",
        feature: reservation.feature,
        groupId: reservation.groupId,
        state: "failed",
        estimatedUsage: {
          inputTokens: reservation.estimatedInputTokens,
          outputTokens: reservation.estimatedOutputTokens,
          totalTokens: reservation.estimatedTokens,
          usd: reservation.estimatedUsd,
        },
        error: error instanceof Error ? error.message : "AI request failed.",
      } as Prisma.InputJsonValue,
    },
  });
}

export async function runWithAiBudget<T>({
  countedCalls,
  countedFiles,
  estimatedInputTokens,
  estimatedOutputTokens,
  execute,
  feature,
  inputSummary,
  model,
  userId,
}: {
  countedCalls?: number;
  countedFiles?: number;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  execute: () => Promise<T>;
  feature: AiBudgetFeature;
  inputSummary?: Prisma.InputJsonValue;
  model?: string | null;
  userId: string;
}) {
  const budget = await reserveAiBudget({
    countedCalls,
    countedFiles,
    estimatedInputTokens,
    estimatedOutputTokens,
    feature,
    inputSummary,
    model,
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

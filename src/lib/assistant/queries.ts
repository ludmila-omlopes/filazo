import type { Prisma } from "@prisma/client";
import { AssistantSignalType } from "@prisma/client";
import {
  buildFallbackAssistantSummary,
  recommendPlayNextGames,
  summarizeAssistantInsights,
  type AssistantAiOutput,
  type PlayNextRecommendation,
} from "@/lib/assistant/ai";
import {
  getAiBudgetLimits,
  getAiBudgetUsageForUser,
} from "../ai-budget.ts";
import { getAiSettings } from "../ai-settings.ts";
import {
  buildLibrarySummary,
  readStringList,
  scoreBacklogEntries,
  type AssistantEntry,
  type AssistantInsight,
} from "@/lib/assistant/scoring";
import { prisma } from "@/lib/prisma";

export type AssistantProfileData = Awaited<ReturnType<typeof getAssistantProfileData>>;

type AssistantEntryPayload = Prisma.UserGameEntryGetPayload<{
  include: {
    game: {
      include: {
        providerLinks: true;
      };
    };
  };
}>;

type AssistantInsightPayload = Prisma.UserGameInsightGetPayload<{
  include: {
    userGameEntry: {
      include: {
        game: {
          include: {
            providerLinks: true;
          };
        };
      };
    };
  };
}>;

type LatestAssistantRunPayload = Prisma.AssistantRunGetPayload<object>;

const AI_REFRESH_LIMITS = {
  userCooldownMs: 10 * 60 * 1000,
} as const;

const AI_BUDGET_STATUSES = [
  "AI_BUDGET_RESERVED",
  "AI_BUDGET_USED",
  "AI_BUDGET_FAILED",
];

type AssistantAiSkipReason =
  | "CACHE_HIT"
  | "FEATURE_DISABLED"
  | "USER_COOLDOWN"
  | "USER_DAILY_LIMIT"
  | "GLOBAL_DAILY_LIMIT";

type AssistantAiRefreshDecision = {
  allowAi: boolean;
  skippedReason: AssistantAiSkipReason | null;
  cachedSummary: AssistantAiOutput | null;
  cachedRecommendations: PlayNextRecommendation[] | null;
  cachedRecommendationSource: "openai" | "rules" | null;
};

export type PlayNextProfileRecommendation = PlayNextRecommendation & {
  source: "openai" | "rules";
  entry: AssistantEntryPayload;
};

function toAssistantEntry(
  entry: AssistantEntryPayload,
): AssistantEntry {
  return {
    id: entry.id,
    status: entry.status,
    source: entry.source,
    provider: entry.provider,
    playtimeMinutes: entry.playtimeMinutes,
    lastPlayedAt: entry.lastPlayedAt,
    completionPercent: entry.completionPercent,
    finishedAt: entry.finishedAt,
    isFavorite: entry.isFavorite,
    activeBacklog: entry.activeBacklog,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    lastSyncedAt: entry.lastSyncedAt,
    platformName: entry.platformName,
    userIntent: entry.userIntent,
    desiredSessionMin: entry.desiredSessionMin,
    game: {
      id: entry.game.id,
      slug: entry.game.slug,
      name: entry.game.name,
      summary: entry.game.summary,
      genres: entry.game.genres,
      platforms: entry.game.platforms,
      metadataSource: entry.game.metadataSource,
      aggregatedRating: entry.game.aggregatedRating,
      hltbMainStoryMinutes: entry.game.hltbMainStoryMinutes,
      hltbMainExtraMinutes: entry.game.hltbMainExtraMinutes,
      hltbCompletionistMinutes: entry.game.hltbCompletionistMinutes,
      providerLinks: entry.game.providerLinks.map((link) => ({
        provider: link.provider,
        hasStoreUrl: Boolean(link.storeUrl),
      })),
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readRecommendationSource(value: unknown): "openai" | "rules" {
  return value === "openai" ? "openai" : "rules";
}

function readStoredPlayNextRecommendations(
  outputSummary: Prisma.JsonValue | null,
) {
  if (!isObject(outputSummary)) {
    return [];
  }

  const recommendations = outputSummary.playNextRecommendations;
  if (!Array.isArray(recommendations)) {
    return [];
  }

  return recommendations
    .map((recommendation) => {
      if (!isObject(recommendation)) {
        return null;
      }

      const entryId = recommendation.entryId;
      const gameId = recommendation.gameId;
      const slug = recommendation.slug;
      const title = recommendation.title;
      const expectedEffort = recommendation.expectedEffort;
      const moodFit = recommendation.moodFit;
      const reason = recommendation.reason;
      const primaryGenre = recommendation.primaryGenre;

      if (
        typeof entryId !== "string" ||
        typeof gameId !== "string" ||
        typeof slug !== "string" ||
        typeof title !== "string" ||
        typeof expectedEffort !== "string" ||
        typeof moodFit !== "string" ||
        typeof reason !== "string"
      ) {
        return null;
      }

      return {
        entryId,
        gameId,
        slug,
        title,
        primaryGenre: typeof primaryGenre === "string" ? primaryGenre : null,
        expectedEffort,
        moodFit,
        reason,
      } satisfies PlayNextRecommendation;
    })
    .filter(
      (recommendation): recommendation is PlayNextRecommendation =>
        recommendation !== null,
    );
}

function readStoredAssistantSummary(
  outputSummary: Prisma.JsonValue | null,
): AssistantAiOutput | null {
  if (!isObject(outputSummary)) {
    return null;
  }

  const headline = outputSummary.headline;
  const explanation = outputSummary.explanation;
  const nextQuestion = outputSummary.nextQuestion;
  const actionLabel = outputSummary.actionLabel;
  const caveats = outputSummary.caveats;

  if (
    typeof headline !== "string" ||
    typeof explanation !== "string" ||
    typeof actionLabel !== "string" ||
    !Array.isArray(caveats)
  ) {
    return null;
  }

  return {
    headline,
    explanation,
    nextQuestion: typeof nextQuestion === "string" ? nextQuestion : undefined,
    actionLabel,
    caveats: caveats.filter((item): item is string => typeof item === "string"),
  };
}

function getLatestAssistantContextUpdatedAt(entries: AssistantEntryPayload[]) {
  const latestTime = entries.reduce((latest, entry) => {
    const timestamps = [
      entry.updatedAt,
      entry.lastSyncedAt,
      entry.game.updatedAt,
    ]
      .filter((date): date is Date => Boolean(date))
      .map((date) => date.getTime());

    return Math.max(latest, ...timestamps);
  }, 0);

  return latestTime ? new Date(latestTime) : null;
}

function getReusablePlayNextRecommendations({
  latestRun,
  entries,
}: {
  latestRun: LatestAssistantRunPayload | null;
  entries: AssistantEntryPayload[];
}) {
  if (!latestRun || !isObject(latestRun.outputSummary)) {
    return null;
  }

  const source = readRecommendationSource(
    latestRun.outputSummary.recommendationSource,
  );
  if (source !== "openai") {
    return null;
  }

  const latestContextUpdate = getLatestAssistantContextUpdatedAt(entries);
  if (
    latestContextUpdate &&
    latestContextUpdate.getTime() > latestRun.createdAt.getTime()
  ) {
    return null;
  }

  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const recommendations = readStoredPlayNextRecommendations(
    latestRun.outputSummary,
  ).filter((recommendation) => {
    const entry = entryById.get(recommendation.entryId);

    return (
      entry &&
      entry.gameId === recommendation.gameId &&
      entry.game.slug === recommendation.slug
    );
  });

  return recommendations.length === 3
    ? {
        recommendations,
        summary: readStoredAssistantSummary(latestRun.outputSummary),
        source,
      }
    : null;
}

async function getAssistantAiRefreshDecision({
  userId,
  latestRun,
  entries,
  now,
}: {
  userId: string;
  latestRun: LatestAssistantRunPayload | null;
  entries: AssistantEntryPayload[];
  now: Date;
}): Promise<AssistantAiRefreshDecision> {
  const reusable = getReusablePlayNextRecommendations({ latestRun, entries });
  if (reusable) {
    return {
      allowAi: false,
      skippedReason: "CACHE_HIT",
      cachedSummary: reusable.summary,
      cachedRecommendations: reusable.recommendations,
      cachedRecommendationSource: reusable.source,
    };
  }

  const settings = await getAiSettings();
  if (
    !settings.assistantSummaryEnabled &&
    !settings.assistantPlayNextEnabled
  ) {
    return {
      allowAi: false,
      skippedReason: "FEATURE_DISABLED",
      cachedSummary: null,
      cachedRecommendations: null,
      cachedRecommendationSource: null,
    };
  }

  const [latestAiRun, aiBudget] = await Promise.all([
    prisma.assistantRun.findFirst({
      where: {
        userId,
        status: "COMPLETED_AI",
      },
      orderBy: { createdAt: "desc" },
    }),
    getAiBudgetUsageForUser(userId, now),
  ]);

  if (
    latestAiRun &&
    now.getTime() - latestAiRun.createdAt.getTime() <
      AI_REFRESH_LIMITS.userCooldownMs
  ) {
    return {
      allowAi: false,
      skippedReason: "USER_COOLDOWN",
      cachedSummary: null,
      cachedRecommendations: null,
      cachedRecommendationSource: null,
    };
  }

  if (aiBudget.userRemainingToday <= 0) {
    return {
      allowAi: false,
      skippedReason: "USER_DAILY_LIMIT",
      cachedSummary: null,
      cachedRecommendations: null,
      cachedRecommendationSource: null,
    };
  }

  if (aiBudget.globalRemainingToday <= 0) {
    return {
      allowAi: false,
      skippedReason: "GLOBAL_DAILY_LIMIT",
      cachedSummary: null,
      cachedRecommendations: null,
      cachedRecommendationSource: null,
    };
  }

  return {
    allowAi: true,
    skippedReason: null,
    cachedSummary: null,
    cachedRecommendations: null,
    cachedRecommendationSource: null,
  };
}

async function getAssistantAiUsageForUser(userId: string, now = new Date()) {
  const [latestAiRun, aiBudget, settings] = await Promise.all([
    prisma.assistantRun.findFirst({
      where: {
        userId,
        status: "COMPLETED_AI",
      },
      orderBy: { createdAt: "desc" },
    }),
    getAiBudgetUsageForUser(userId, now),
    getAiSettings(),
  ]);
  const cooldownRemainingMs = latestAiRun
    ? Math.max(
        0,
        AI_REFRESH_LIMITS.userCooldownMs -
          (now.getTime() - latestAiRun.createdAt.getTime()),
      )
    : 0;

  return {
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
    userDailyLimit: aiBudget.userDailyLimit,
    userUsedToday: aiBudget.userUsedToday,
    userRemainingToday: aiBudget.userRemainingToday,
    globalDailyLimit: aiBudget.globalDailyLimit,
    globalRemainingToday: aiBudget.globalRemainingToday,
    effectiveRemainingToday: aiBudget.effectiveRemainingToday,
    assistantChatEnabled: settings.assistantChatEnabled,
    assistantRefreshEnabled:
      settings.assistantSummaryEnabled || settings.assistantPlayNextEnabled,
    cooldownMinutes: AI_REFRESH_LIMITS.userCooldownMs / 60000,
    cooldownRemainingSeconds: Math.ceil(cooldownRemainingMs / 1000),
    canUseAiNow:
      Boolean(process.env.OPENAI_API_KEY) &&
      (settings.assistantSummaryEnabled ||
        settings.assistantPlayNextEnabled) &&
      aiBudget.effectiveRemainingToday > 0 &&
      cooldownRemainingMs === 0,
  };
}

export async function getAssistantChatGate(userId: string, now = new Date()) {
  const [aiBudget, settings] = await Promise.all([
    getAiBudgetUsageForUser(userId, now),
    getAiSettings(),
  ]);
  const chatBudgetUnits = Math.max(1, settings.chatBudgetUnits);

  if (!settings.assistantChatEnabled) {
    return {
      allowed: false as const,
      message: "Library chat is disabled in admin settings.",
    };
  }

  if (aiBudget.userRemainingToday < chatBudgetUnits) {
    return {
      allowed: false as const,
      message: `Daily AI limit reached (${aiBudget.userDailyLimit} units per day). The chat reopens tomorrow.`,
    };
  }

  if (aiBudget.globalRemainingToday < chatBudgetUnits) {
    return {
      allowed: false as const,
      message: "The app-wide AI budget for today is used up. Try again tomorrow.",
    };
  }

  return { allowed: true as const };
}

export async function recordAssistantChatRun({
  userId,
  model,
  messageCount,
  stepCount,
  toolCallCount,
  usage,
}: {
  userId: string;
  model: string;
  messageCount: number;
  stepCount: number;
  toolCallCount: number;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
}) {
  await prisma.assistantRun.create({
    data: {
      userId,
      inputSummary: {
        kind: "library_chat",
        messageCount,
      } as Prisma.InputJsonValue,
      outputSummary: {
        kind: "library_chat",
        stepCount,
        toolCallCount,
        usage,
      } as Prisma.InputJsonValue,
      model,
      status: "COMPLETED_CHAT_AI",
    },
  });
}

function readInsightReasons(reasons: Prisma.JsonValue) {
  if (!Array.isArray(reasons)) {
    return [];
  }

  return reasons
    .map((reason) =>
      isObject(reason) && typeof reason.evidence === "string"
        ? reason.evidence
        : "",
    )
    .filter(Boolean);
}

function buildStoredPlayNextRecommendations({
  latestRun,
  entries,
}: {
  latestRun: LatestAssistantRunPayload | null;
  entries: AssistantEntryPayload[];
}): PlayNextProfileRecommendation[] {
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const source = readRecommendationSource(
    isObject(latestRun?.outputSummary)
      ? latestRun.outputSummary.recommendationSource
      : null,
  );
  const storedRecommendations: PlayNextProfileRecommendation[] = [];

  for (const recommendation of readStoredPlayNextRecommendations(
    latestRun?.outputSummary ?? null,
  )) {
    const entry = entryById.get(recommendation.entryId);
    if (
      !entry ||
      entry.gameId !== recommendation.gameId ||
      entry.game.slug !== recommendation.slug
    ) {
      continue;
    }

    storedRecommendations.push({
      ...recommendation,
      title: entry.game.name,
      primaryGenre:
        recommendation.primaryGenre ?? readStringList(entry.game.genres)[0] ?? null,
      source,
      entry,
    });

    if (storedRecommendations.length === 3) {
      break;
    }
  }

  return storedRecommendations;
}

function buildRulePlayNextRecommendations(
  insights: AssistantInsightPayload[],
): PlayNextProfileRecommendation[] {
  return selectPlayNext(insights).map((insight) => {
    const reasons = readInsightReasons(insight.reasons);
    const primaryGenre = readStringList(insight.userGameEntry.game.genres)[0] ?? null;

    return {
      entryId: insight.userGameEntryId,
      gameId: insight.userGameEntry.gameId,
      slug: insight.userGameEntry.game.slug,
      title: insight.userGameEntry.game.name,
      primaryGenre,
      expectedEffort: "Rule fallback",
      moodFit: primaryGenre
        ? `${primaryGenre} change of pace`
        : "Low-decision catalog pick",
      reason:
        [reasons[0], insight.suggestedAction].filter(Boolean).join(" ") ||
        "Selected from local shelf signals.",
      source: "rules",
      entry: insight.userGameEntry,
    };
  });
}

export async function getAssistantProfileData(userId: string) {
  const [entries, insights, latestRun, aiUsage] = await Promise.all([
    prisma.userGameEntry.findMany({
      where: { userId },
      include: {
        game: {
          include: {
            providerLinks: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.userGameInsight.findMany({
      where: { userId },
      include: {
        userGameEntry: {
          include: {
            game: {
              include: {
                providerLinks: true,
              },
            },
          },
        },
      },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.assistantRun.findFirst({
      where: {
        userId,
        status: { notIn: AI_BUDGET_STATUSES },
      },
      orderBy: { createdAt: "desc" },
    }),
    getAssistantAiUsageForUser(userId),
  ]);

  const assistantEntries = entries.map(toAssistantEntry);
  const librarySummary = buildLibrarySummary(assistantEntries);
  const storedPlayNextRecommendations = buildStoredPlayNextRecommendations({
    latestRun,
    entries,
  });

  return {
    entries,
    insights,
    latestRun,
    librarySummary,
    aiUsage,
    generatedInsights: scoreBacklogEntries(assistantEntries).slice(0, 8),
    playNextRecommendations: storedPlayNextRecommendations.length
      ? storedPlayNextRecommendations
      : buildRulePlayNextRecommendations(insights),
  };
}

export async function getAssistantSignalEntryIds(
  userId: string,
  signalType: AssistantSignalType,
) {
  const insights = await prisma.userGameInsight.findMany({
    where: {
      userId,
      signalType,
    },
    select: {
      userGameEntryId: true,
    },
  });

  return new Set(insights.map((insight) => insight.userGameEntryId));
}

export async function refreshAssistantInsightsForUser(userId: string) {
  const [entries, latestRun] = await Promise.all([
    prisma.userGameEntry.findMany({
      where: { userId },
      include: {
        game: {
          include: {
            providerLinks: true,
          },
        },
      },
    }),
    prisma.assistantRun.findFirst({
      where: {
        userId,
        status: { notIn: AI_BUDGET_STATUSES },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const assistantEntries = entries.map(toAssistantEntry);
  const ruleInsights = scoreBacklogEntries(assistantEntries);
  const userLibrarySummary = buildLibrarySummary(assistantEntries);
  const aiDecision = await getAssistantAiRefreshDecision({
    userId,
    latestRun,
    entries,
    now: new Date(),
  });
  const summaryInput = {
    userLibrarySummary,
    ruleInsights: ruleInsights.slice(0, 8),
  };
  const aiBudgetLimits = await getAiBudgetLimits();
  const playNextInput = {
    userLibrarySummary,
    entries: assistantEntries,
    ruleInsights: ruleInsights.slice(0, 24),
  };
  const [summary, playNext] = aiDecision.cachedRecommendations
    ? [
        {
          output:
            aiDecision.cachedSummary ??
            buildFallbackAssistantSummary(summaryInput),
          model: latestRun?.model ?? null,
          usedAi: false,
        },
        {
          recommendations: aiDecision.cachedRecommendations,
          model: latestRun?.model ?? null,
          usedAi: false,
        },
      ]
    : await Promise.all([
        summarizeAssistantInsights(summaryInput, {
          allowAi: aiDecision.allowAi,
          userId,
        }),
        recommendPlayNextGames(playNextInput, {
          allowAi: aiDecision.allowAi,
          userId,
        }),
      ]);
  const recommendationSource =
    aiDecision.cachedRecommendationSource ??
    (playNext.usedAi ? "openai" : "rules");
  const runStatus =
    summary.usedAi || playNext.usedAi
      ? "COMPLETED_AI"
      : aiDecision.skippedReason === "CACHE_HIT"
        ? "COMPLETED_CACHE"
        : "COMPLETED_RULES";

  for (const insight of ruleInsights) {
    await upsertInsight(userId, insight);
  }

  await prisma.assistantRun.create({
    data: {
      userId,
      inputSummary: {
        userLibrarySummary,
        insightCount: ruleInsights.length,
        recommendationCandidateCount: assistantEntries.length,
        ai: {
          allowAi: aiDecision.allowAi,
          skippedReason: aiDecision.skippedReason,
          limits: {
            userCooldownMinutes: AI_REFRESH_LIMITS.userCooldownMs / 60000,
            ...aiBudgetLimits,
          },
        },
      } as Prisma.InputJsonValue,
      outputSummary: {
        ...summary.output,
        playNextRecommendations: playNext.recommendations,
        recommendationSource,
        aiSkippedReason: aiDecision.skippedReason,
      } as Prisma.InputJsonValue,
      model: playNext.model ?? summary.model,
      status: runStatus,
    },
  });

  return {
    insightCount: ruleInsights.length,
    summary: summary.output,
  };
}

async function upsertInsight(userId: string, insight: AssistantInsight) {
  await prisma.userGameInsight.upsert({
    where: {
      userGameEntryId_signalType: {
        userGameEntryId: insight.entryId,
        signalType: insight.signalType,
      },
    },
    update: {
      friction: insight.friction,
      score: insight.score,
      confidence: insight.confidence,
      reasons: insight.reasons as Prisma.InputJsonValue,
      suggestedAction: insight.suggestedAction,
      generatedBy: "rules",
    },
    create: {
      userId,
      userGameEntryId: insight.entryId,
      signalType: insight.signalType,
      friction: insight.friction,
      score: insight.score,
      confidence: insight.confidence,
      reasons: insight.reasons as Prisma.InputJsonValue,
      suggestedAction: insight.suggestedAction,
      generatedBy: "rules",
    },
  });
}

export function selectPlayNext(insights: AssistantInsightPayload[]) {
  const bySignal = new Map<AssistantSignalType, AssistantInsightPayload>();

  for (const insight of insights) {
    if (!bySignal.has(insight.signalType)) {
      bySignal.set(insight.signalType, insight);
    }
  }

  return [
    bySignal.get(AssistantSignalType.FINISHABLE_SOON),
    bySignal.get(AssistantSignalType.STALE_PLAYING),
    bySignal.get(AssistantSignalType.SAMPLED_DROPPED),
    bySignal.get(AssistantSignalType.UNTOUCHED),
  ].filter(
    (insight): insight is AssistantInsightPayload => insight !== undefined,
  ).slice(0, 3);
}

import { z } from "zod";
import { AssistantSignalType, UserGameStatus } from "@prisma/client";
import { estimateRemainingTime } from "../time-estimates.ts";
import {
  readStringList,
  type AssistantEntry,
  type AssistantInsight,
  type LibrarySummary,
} from "./scoring.ts";

export type AssistantAiInput = {
  userLibrarySummary: LibrarySummary;
  candidate?: {
    title: string;
    status?: string;
    price?: string;
    genres?: string[];
    platforms?: string[];
    reasonUserWantsIt?: string;
  };
  ruleInsights: AssistantInsight[];
};

export type AssistantAiOutput = {
  headline: string;
  explanation: string;
  nextQuestion?: string;
  actionLabel: string;
  caveats: string[];
};

export type PlayNextRecommendation = {
  entryId: string;
  gameId: string;
  slug: string;
  title: string;
  primaryGenre: string | null;
  expectedEffort: string;
  moodFit: string;
  reason: string;
};

export type PlayNextRecommendationInput = {
  userLibrarySummary: LibrarySummary;
  entries: AssistantEntry[];
  ruleInsights: AssistantInsight[];
};

type AssistantAiOptions = {
  allowAi?: boolean;
};

const AssistantAiOutputSchema = z.object({
  headline: z.string().min(1),
  explanation: z.string().min(1),
  nextQuestion: z.string().optional(),
  actionLabel: z.string().min(1),
  caveats: z.array(z.string()).default([]),
});

const PlayNextRecommendationSchema = z.object({
  recommendations: z
    .array(
      z.object({
        entryId: z.string().min(1),
        gameId: z.string().min(1),
        slug: z.string().min(1),
        title: z.string().min(1),
        primaryGenre: z.string().nullable(),
        expectedEffort: z.string().min(1),
        moodFit: z.string().min(1),
        reason: z.string().min(1),
      }),
    )
    .length(3),
});

function getOpenAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
  };
}

function extractOutputText(response: unknown) {
  if (!response || typeof response !== "object") {
    return null;
  }

  const maybeText = (response as { output_text?: unknown }).output_text;
  if (typeof maybeText === "string") {
    return maybeText;
  }

  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") {
        continue;
      }
      const text = (contentItem as { text?: unknown }).text;
      if (typeof text === "string") {
        return text;
      }
    }
  }

  return null;
}

function getInsightMap(insights: AssistantInsight[]) {
  const map = new Map<string, AssistantInsight[]>();

  for (const insight of insights) {
    const existing = map.get(insight.entryId) ?? [];
    existing.push(insight);
    map.set(insight.entryId, existing);
  }

  return map;
}

function getPrimaryGenre(entry: AssistantEntry) {
  return readStringList(entry.game.genres)[0] ?? null;
}

function getExpectedEffort(entry: AssistantEntry) {
  const remainingTime = estimateRemainingTime(entry);
  if (!remainingTime) {
    return "Low setup, unknown length";
  }

  if (remainingTime.remainingMinutes <= 180) {
    return "Short session";
  }

  if (remainingTime.remainingMinutes <= 720) {
    return "Medium effort";
  }

  return "Longer commitment";
}

function scorePlayNextCandidate(
  entry: AssistantEntry,
  insights: AssistantInsight[],
) {
  const bestInsightScore = insights
    .filter(
      (insight) =>
        insight.signalType !== AssistantSignalType.RELEASE_CANDIDATE &&
        insight.signalType !== AssistantSignalType.WISHLIST_RISK,
    )
    .reduce((score, insight) => Math.max(score, insight.score), 0);
  const remainingTime = estimateRemainingTime(entry);
  const statusScore =
    entry.status === UserGameStatus.PLAYING
      ? 18
      : entry.status === UserGameStatus.BACKLOG
        ? 14
        : entry.status === UserGameStatus.OWNED
          ? 10
          : -20;
  const timeScore = remainingTime
    ? Math.max(0, 16 - remainingTime.remainingMinutes / 60)
    : 0;
  const favoriteScore = entry.isFavorite ? 8 : 0;

  return bestInsightScore + statusScore + timeScore + favoriteScore;
}

function getRecommendationReason(
  entry: AssistantEntry,
  insights: AssistantInsight[],
) {
  const usefulInsight = insights.find(
    (insight) =>
      insight.signalType !== AssistantSignalType.RELEASE_CANDIDATE &&
      insight.signalType !== AssistantSignalType.WISHLIST_RISK,
  );
  const evidence = usefulInsight?.reasons[0]?.evidence;

  if (evidence && usefulInsight?.suggestedAction) {
    return `${evidence} ${usefulInsight.suggestedAction}`;
  }

  if (evidence) {
    return evidence;
  }

  const genre = getPrimaryGenre(entry);
  if (genre) {
    return `A low-friction ${genre} option already in the catalog.`;
  }

  return "A familiar catalog option with enough user context to make it a safe next step.";
}

function sortPlayNextCandidates(input: PlayNextRecommendationInput) {
  const insightMap = getInsightMap(input.ruleInsights);
  const playableEntries = input.entries.filter(
    (entry) =>
      entry.activeBacklog !== false &&
      entry.status !== UserGameStatus.COMPLETED,
  );
  const ownedEntries = playableEntries.filter(
    (entry) => entry.status !== UserGameStatus.WISHLIST,
  );
  const baseEntries = ownedEntries.length >= 3 ? ownedEntries : playableEntries;

  return [...baseEntries].sort(
    (left, right) =>
      scorePlayNextCandidate(right, insightMap.get(right.id) ?? []) -
      scorePlayNextCandidate(left, insightMap.get(left.id) ?? []),
  );
}

function selectDiverseEntries(entries: AssistantEntry[], count: number) {
  const selected: AssistantEntry[] = [];
  const usedGenres = new Set<string>();

  for (const entry of entries) {
    const genre = getPrimaryGenre(entry)?.toLowerCase() ?? null;
    if (genre && usedGenres.has(genre)) {
      continue;
    }

    selected.push(entry);
    if (genre) {
      usedGenres.add(genre);
    }

    if (selected.length === count) {
      return selected;
    }
  }

  for (const entry of entries) {
    if (selected.some((selectedEntry) => selectedEntry.id === entry.id)) {
      continue;
    }

    selected.push(entry);
    if (selected.length === count) {
      return selected;
    }
  }

  return selected;
}

function toFallbackRecommendation(
  entry: AssistantEntry,
  insights: AssistantInsight[],
): PlayNextRecommendation {
  const primaryGenre = getPrimaryGenre(entry);

  return {
    entryId: entry.id,
    gameId: entry.game.id,
    slug: entry.game.slug,
    title: entry.game.name,
    primaryGenre,
    expectedEffort: getExpectedEffort(entry),
    moodFit: primaryGenre
      ? `${primaryGenre} change of pace`
      : "Low-decision catalog pick",
    reason: getRecommendationReason(entry, insights),
  };
}

export function buildFallbackPlayNextRecommendations(
  input: PlayNextRecommendationInput,
) {
  const insightMap = getInsightMap(input.ruleInsights);
  const selectedEntries = selectDiverseEntries(sortPlayNextCandidates(input), 3);

  return selectedEntries.map((entry) =>
    toFallbackRecommendation(entry, insightMap.get(entry.id) ?? []),
  );
}

function buildPlayNextContext(input: PlayNextRecommendationInput) {
  const insightMap = getInsightMap(input.ruleInsights);
  const candidates = sortPlayNextCandidates(input).slice(0, 80);

  return {
    userLibrarySummary: input.userLibrarySummary,
    candidateGames: candidates.map((entry) => {
      const insights = insightMap.get(entry.id) ?? [];
      const remainingTime = estimateRemainingTime(entry);

      return {
        entryId: entry.id,
        gameId: entry.game.id,
        slug: entry.game.slug,
        title: entry.game.name,
        summary: entry.game.summary,
        genres: readStringList(entry.game.genres).slice(0, 5),
        platforms: [
          ...new Set(
            [
              entry.platformName,
              ...readStringList(entry.game.platforms),
            ].filter((item): item is string => Boolean(item)),
          ),
        ].slice(0, 6),
        status: entry.status,
        source: entry.source,
        provider: entry.provider,
        providerSources: [
          ...new Set([
            entry.provider,
            ...(entry.game.providerLinks ?? []).map((link) => link.provider),
          ]),
        ].filter(Boolean),
        playtimeMinutes: entry.playtimeMinutes,
        completionPercent: entry.completionPercent,
        lastPlayedAt: entry.lastPlayedAt?.toISOString() ?? null,
        lastSyncedAt: entry.lastSyncedAt?.toISOString() ?? null,
        updatedAt: entry.updatedAt?.toISOString() ?? null,
        isFavorite: entry.isFavorite,
        activeBacklog: entry.activeBacklog,
        userIntent: entry.userIntent,
        desiredSessionMin: entry.desiredSessionMin,
        aggregatedRating: entry.game.aggregatedRating,
        metadataSource: entry.game.metadataSource,
        estimatedRemainingMinutes: remainingTime?.remainingMinutes ?? null,
        estimatedRemainingBasis: remainingTime?.targetLabel ?? null,
        ruleSignals: insights.map((insight) => ({
          signalType: insight.signalType,
          friction: insight.friction,
          score: insight.score,
          confidence: insight.confidence,
          reasons: insight.reasons.map((reason) => reason.evidence),
          suggestedAction: insight.suggestedAction,
        })),
      };
    }),
  };
}

function validateCatalogRecommendations(
  recommendations: PlayNextRecommendation[],
  input: PlayNextRecommendationInput,
) {
  const entryById = new Map(input.entries.map((entry) => [entry.id, entry]));
  const seenEntryIds = new Set<string>();
  const validRecommendations: PlayNextRecommendation[] = [];

  for (const recommendation of recommendations) {
    const entry = entryById.get(recommendation.entryId);
    if (
      !entry ||
      seenEntryIds.has(entry.id) ||
      recommendation.gameId !== entry.game.id ||
      recommendation.slug !== entry.game.slug
    ) {
      continue;
    }

    seenEntryIds.add(entry.id);
    validRecommendations.push({
      ...recommendation,
      title: entry.game.name,
      primaryGenre: recommendation.primaryGenre ?? getPrimaryGenre(entry),
    });
  }

  if (validRecommendations.length !== 3) {
    throw new Error("OpenAI recommendations did not map to three catalog entries.");
  }

  return validRecommendations;
}

export function buildFallbackAssistantSummary(input: AssistantAiInput): AssistantAiOutput {
  const topInsight = input.ruleInsights[0];
  if (!topInsight) {
    return {
      headline: "No backlog pressure detected",
      explanation: "There is not enough activity yet to produce a useful diagnosis.",
      actionLabel: "Sync or import more games",
      caveats: ["Steam and CSV data quality affect assistant accuracy."],
    };
  }

  return {
    headline: "Your backlog needs a smaller next step",
    explanation: topInsight.reasons.map((reason) => reason.evidence).join(" "),
    nextQuestion: "Was the blocker time, mood, difficulty, or another game pulling you away?",
    actionLabel: topInsight.suggestedAction,
    caveats: ["This is based on library signals, not a judgment of taste."],
  };
}

export async function recommendPlayNextGames(
  input: PlayNextRecommendationInput,
  options: AssistantAiOptions = {},
): Promise<{
  recommendations: PlayNextRecommendation[];
  model: string | null;
  usedAi: boolean;
}> {
  const fallbackRecommendations = buildFallbackPlayNextRecommendations(input);
  if (options.allowAi === false) {
    return {
      recommendations: fallbackRecommendations,
      model: null,
      usedAi: false,
    };
  }

  const config = getOpenAiConfig();
  if (!config || fallbackRecommendations.length < 3) {
    return {
      recommendations: fallbackRecommendations,
      model: config?.model ?? null,
      usedAi: false,
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        input: [
          {
            role: "system",
            content:
              "You are a specialized neuroscientist and gamer focused on giving the user the best possible next-game experience from their existing backlog. Return concise JSON only. Recommend only games from the provided candidateGames list.",
          },
          {
            role: "user",
            content: JSON.stringify({
              instructions: [
                "Pick exactly 3 games from candidateGames.",
                "Use entryId, gameId, slug, and title exactly as provided.",
                "Do not invent games or recommend anything outside candidateGames.",
                "Prefer games the user owns, is playing, or has in backlog before wishlist-only games.",
                "Maximize genre variety; choose different primary genres whenever the catalog data makes that possible.",
                "Prioritize low activation energy, avoiding choice overload, progress/playtime signals, and variety of cognitive or emotional effort.",
                "Write one short user-facing reason per pick.",
              ],
              catalogContext: buildPlayNextContext(input),
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "play_next_recommendations",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                recommendations: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      entryId: { type: "string" },
                      gameId: { type: "string" },
                      slug: { type: "string" },
                      title: { type: "string" },
                      primaryGenre: {
                        type: ["string", "null"],
                      },
                      expectedEffort: { type: "string" },
                      moodFit: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: [
                      "entryId",
                      "gameId",
                      "slug",
                      "title",
                      "primaryGenre",
                      "expectedEffort",
                      "moodFit",
                      "reason",
                    ],
                  },
                },
              },
              required: ["recommendations"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with ${response.status}.`);
    }

    const json = await response.json();
    const outputText = extractOutputText(json);
    if (!outputText) {
      throw new Error("OpenAI response did not include output text.");
    }

    const output = PlayNextRecommendationSchema.parse(JSON.parse(outputText));

    return {
      recommendations: validateCatalogRecommendations(
        output.recommendations,
        input,
      ),
      model: config.model,
      usedAi: true,
    };
  } catch {
    return {
      recommendations: fallbackRecommendations,
      model: config.model,
      usedAi: false,
    };
  }
}

export async function summarizeAssistantInsights(
  input: AssistantAiInput,
  options: AssistantAiOptions = {},
): Promise<{ output: AssistantAiOutput; model: string | null; usedAi: boolean }> {
  if (options.allowAi === false) {
    return {
      output: buildFallbackAssistantSummary(input),
      model: null,
      usedAi: false,
    };
  }

  const config = getOpenAiConfig();
  if (!config) {
    return {
      output: buildFallbackAssistantSummary(input),
      model: null,
      usedAi: false,
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        input: [
          {
            role: "system",
            content:
              "You are a calm game-library decision assistant. Return concise JSON only. Avoid guilt language.",
          },
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "assistant_ai_output",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                headline: { type: "string" },
                explanation: { type: "string" },
                nextQuestion: { type: "string" },
                actionLabel: { type: "string" },
                caveats: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: [
                "headline",
                "explanation",
                "nextQuestion",
                "actionLabel",
                "caveats",
              ],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with ${response.status}.`);
    }

    const json = await response.json();
    const outputText = extractOutputText(json);
    if (!outputText) {
      throw new Error("OpenAI response did not include output text.");
    }

    return {
      output: AssistantAiOutputSchema.parse(JSON.parse(outputText)),
      model: config.model,
      usedAi: true,
    };
  } catch {
    return {
      output: buildFallbackAssistantSummary(input),
      model: config.model,
      usedAi: false,
    };
  }
}

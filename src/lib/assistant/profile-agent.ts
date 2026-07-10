import type { Prisma } from "@prisma/client";
import { UserGameStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOpenAiConfig, type OpenAiConfig } from "@/lib/openai";
import { getAiOutputLanguageInstruction } from "@/lib/ai-locale";
import {
  markAiBudgetFailed,
  markAiBudgetUsed,
  reserveAiBudget,
} from "../ai-budget.ts";
import { estimateTokensFromValue } from "../ai-estimates.ts";
import { getAiSettings, type AiSettingsValues } from "../ai-settings.ts";
import type { Locale } from "@/lib/i18n";
import {
  listGamesArgsSchema,
  loadLibraryEntries,
  runGenreStats,
  runLibraryOverview,
  runListGames,
  runPlayerFeedback,
  type LibraryEntry,
} from "./library-tools.ts";

/**
 * Agentic player-profile generation (issue #19).
 *
 * Instead of stuffing the whole library into one prompt, the model runs as an
 * agent: it receives the read-only tools from `library-tools.ts` (overview,
 * game lists, feedback/reviews, genre stats), decides which to call, and
 * finishes by calling `submit_player_profile` with a structured profile.
 */

export const PLAYER_PROFILE_EMPTY_MESSAGE =
  "Your shelf is quiet right now. Sync a platform or import a CSV before asking for a player profile.";

export const PLAYER_PROFILE_AI_UNAVAILABLE_MESSAGE =
  "The AI module is unavailable. Set OPENAI_API_KEY or OPENROUTER_KEY to generate a player profile.";

const PlayerProfilePayloadSchema = z.object({
  language: z.enum(["en", "pt-BR"]).optional(),
  summary: z.string().min(1),
  preferredGenres: z
    .array(
      z.object({
        genre: z.string().min(1),
        evidence: z.string().min(1),
      }),
    )
    .max(8),
  playStyles: z.array(z.string().min(1)).max(8),
  behaviorPatterns: z.array(z.string().min(1)).max(8),
  recommendations: z
    .array(
      z.object({
        title: z.string().min(1),
        slug: z.string().min(1),
        reason: z.string().min(1),
      }),
    )
    .max(5),
  dataNotes: z.array(z.string()).max(6),
});

export type PlayerProfilePayload = z.infer<typeof PlayerProfilePayloadSchema>;

export type PlayerProfileToolTraceStep = {
  tool: string;
  args: Record<string, unknown>;
  resultSummary: string;
};

export type PlayerProfileAgentResult =
  | { status: "EMPTY" }
  | {
      status: "COMPLETED";
      payload: PlayerProfilePayload;
      model: string;
      toolTrace: PlayerProfileToolTraceStep[];
    };

const AGENT_TOOLS = [
  {
    type: "function",
    name: "get_library_overview",
    description:
      "High-level overview of the user's library: counts per status, favorites, feedback coverage, total playtime, top genres by playtime, and top platforms.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
    strict: true,
  },
  {
    type: "function",
    name: "list_games",
    description:
      "List games from the user's library with playtime, achievement progress, genres, and ratings. Filter by status and sort to inspect different slices.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: {
          type: ["string", "null"],
          enum: [...Object.values(UserGameStatus), null],
          description: "Optional status filter.",
        },
        sortBy: {
          type: ["string", "null"],
          enum: ["playtime", "recent", "rating", "recently_added", null],
          description: "Sort order. Defaults to playtime.",
        },
        limit: {
          type: ["number", "null"],
          description: "Max games to return (1-60). Defaults to 30.",
        },
      },
      required: ["status", "sortBy", "limit"],
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_player_feedback",
    description:
      "All games where the user left explicit feedback: written reviews/notes, abandon reasons, stated intents, or favorites. This is the strongest signal of taste.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_genre_stats",
    description:
      "Per-genre aggregates: game count, total playtime, credits-rolled count, released count, and favorite count.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
    strict: true,
  },
  {
    type: "function",
    name: "submit_player_profile",
    description:
      "Submit the final player profile. Call this exactly once, after you have gathered enough evidence from the other tools.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        language: {
          type: "string",
          enum: ["en", "pt-BR"],
          description: "Language used for every user-facing natural-language field.",
        },
        summary: {
          type: "string",
          description:
            "2-3 short sentences (about 50 words) on who this player is, grounded in their data. Keep it tight; no walls of text.",
        },
        preferredGenres: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              genre: { type: "string" },
              evidence: {
                type: "string",
                description: "Short data-backed justification.",
              },
            },
            required: ["genre", "evidence"],
          },
        },
        playStyles: {
          type: "array",
          maxItems: 8,
          items: { type: "string" },
          description:
            "Experience types the player gravitates to, e.g. long single-player RPGs, short roguelike sessions.",
        },
        behaviorPatterns: {
          type: "array",
          maxItems: 8,
          items: { type: "string" },
          description:
            "Observed habits, e.g. samples then returns, follows long games, or keeps many choices on the shelf.",
        },
        recommendations: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              slug: { type: "string" },
              reason: { type: "string" },
            },
            required: ["title", "slug", "reason"],
          },
          description:
            "Games already in the user's library worth playing next. Use title and slug exactly as returned by the tools.",
        },
        dataNotes: {
          type: "array",
          maxItems: 6,
          items: { type: "string" },
          description:
            "Caveats about thin or missing data, e.g. few reviews, playtime only from Steam.",
        },
      },
      required: [
        "language",
        "summary",
        "preferredGenres",
        "playStyles",
        "behaviorPatterns",
        "recommendations",
        "dataNotes",
      ],
    },
    strict: true,
  },
] as const;

const AGENT_INSTRUCTIONS = [
  "You are a player-profile analyst for filazo, a game library app.",
  "Build an honest, specific profile of this player from their own library data.",
  "Use the tools to gather evidence before concluding. Always check get_player_feedback: explicit reviews, abandon reasons, and favorites outweigh raw playtime.",
  "Ground every claim in data you actually saw. If the data is thin, say so in dataNotes instead of inventing preferences.",
  "Recommendations must come from games returned by the tools, using their exact title and slug. Never invent games.",
  "Voice rule: gentle over gamified. Treat large libraries as abundance, not debt.",
  "Use shelf and curiosity language. Avoid pressure, deadline, and task-list language.",
  "Keep the investigation short: call the evidence-gathering tools you need in the first response, then submit the profile as soon as the tool outputs return.",
  "When you have enough evidence, call submit_player_profile exactly once.",
].join(" ");

type ResponsesApiOutputItem = {
  type?: string;
  name?: string;
  arguments?: string;
  call_id?: string;
};

type ResponsesApiResult = {
  id?: string;
  output?: ResponsesApiOutputItem[];
};

async function callResponsesApi(
  config: OpenAiConfig,
  body: Record<string, unknown>,
  aiSettings: AiSettingsValues,
): Promise<ResponsesApiResult> {
  const response = await fetch(`${config.baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_output_tokens: aiSettings.playerProfileMaxOutputTokens,
      ...body,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request did not complete with status ${response.status}.`);
  }

  return (await response.json()) as ResponsesApiResult;
}

function parseToolArgs(rawArguments: string | undefined) {
  if (!rawArguments) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawArguments);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function executeAgentTool(
  toolName: string,
  args: Record<string, unknown>,
  entries: LibraryEntry[],
) {
  switch (toolName) {
    case "get_library_overview":
      return runLibraryOverview(entries);
    case "list_games":
      return runListGames(entries, listGamesArgsSchema.parse(args));
    case "get_player_feedback":
      return runPlayerFeedback(entries);
    case "get_genre_stats":
      return runGenreStats(entries);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

function summarizeToolResult(result: unknown) {
  if (!result || typeof result !== "object") {
    return "no result";
  }

  return Object.entries(result as Record<string, unknown>)
    .map(([key, value]) =>
      Array.isArray(value)
        ? `${key}: ${value.length} items`
        : typeof value === "number"
          ? `${key}: ${value}`
          : null,
    )
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");
}

function validateRecommendations(
  payload: PlayerProfilePayload,
  entries: LibraryEntry[],
): PlayerProfilePayload {
  const slugToName = new Map(
    entries.map((entry) => [entry.game.slug, entry.game.name]),
  );

  return {
    ...payload,
    recommendations: payload.recommendations
      .filter((recommendation) => slugToName.has(recommendation.slug))
      .map((recommendation) => ({
        ...recommendation,
        title: slugToName.get(recommendation.slug) ?? recommendation.title,
      })),
  };
}

export async function generatePlayerProfile(
  userId: string,
  locale: Locale = "en",
): Promise<PlayerProfileAgentResult> {
  const entries = await loadLibraryEntries(userId);

  if (!entries.length) {
    return { status: "EMPTY" };
  }

  const config = getOpenAiConfig();
  if (!config) {
    throw new Error(PLAYER_PROFILE_AI_UNAVAILABLE_MESSAGE);
  }
  const aiSettings = await getAiSettings();
  if (!aiSettings.playerProfileEnabled) {
    throw new Error("Player profile generation is disabled in admin settings.");
  }

  const languageInstruction = getAiOutputLanguageInstruction(locale);

  const instructions = `${AGENT_INSTRUCTIONS} ${languageInstruction}`;
  const toolTrace: PlayerProfileToolTraceStep[] = [];

  // OpenRouter's Responses API is stateless and does not support
  // previous_response_id, so we thread the transcript ourselves: each turn we
  // echo the model's own output items back into the next request's input,
  // followed by our tool outputs. This also works unchanged against OpenAI.
  const inputItems: Array<Record<string, unknown>> = [
    {
      role: "user",
      content:
        locale === "pt-BR"
          ? "Gere meu perfil de jogador a partir da minha biblioteca do filazo. Investigue primeiro com as ferramentas e depois envie o perfil. Todo texto para a pessoa usuária deve estar exclusivamente em português brasileiro."
          : "Generate my player profile from my filazo library. Investigate with the tools first, then submit the profile.",
    },
  ];

  const budget = await reserveAiBudget({
    countedCalls: 1,
    estimatedInputTokens: estimateTokensFromValue({
      entryCount: entries.length,
      instructions,
      input: inputItems,
      tools: AGENT_TOOLS,
    }),
    estimatedOutputTokens:
      aiSettings.playerProfileMaxCalls *
      aiSettings.playerProfileMaxOutputTokens,
    feature: "player_profile",
    inputSummary: {
      entryCount: entries.length,
      maxModelCalls: aiSettings.playerProfileMaxCalls,
    },
    model: config.model,
    userId,
  });
  if (!budget.allowed) {
    throw new Error(budget.message);
  }

  try {
    let response = await callResponsesApi(config, {
      instructions,
      input: inputItems,
      tools: AGENT_TOOLS,
      tool_choice: "required",
    }, aiSettings);

    for (
      let callIndex = 1;
      callIndex <= aiSettings.playerProfileMaxCalls;
      callIndex += 1
    ) {
      const outputItems = response.output ?? [];
      const functionCalls = outputItems.filter(
        (item) => item.type === "function_call" && item.name,
      );

      if (!functionCalls.length) {
        throw new Error(
          "Player profile agent stopped without submitting a profile.",
        );
      }

      // Carry the model's output (reasoning + function_call items) forward so the
      // next stateless request sees the full conversation.
      inputItems.push(
        ...(outputItems as unknown as Array<Record<string, unknown>>),
      );

      for (const call of functionCalls) {
        const args = parseToolArgs(call.arguments);

        if (call.name === "submit_player_profile") {
          const payload = validateRecommendations(
            PlayerProfilePayloadSchema.parse(args),
            entries,
          );

          if (payload.language !== locale) {
            throw new Error("Player profile agent returned the wrong output language.");
          }

          await markAiBudgetUsed(budget.reservation, {
            status: "COMPLETED",
            toolCallCount: toolTrace.length,
          });

          return {
            status: "COMPLETED",
            payload,
            model: config.model,
            toolTrace,
          };
        }

        const result = executeAgentTool(call.name as string, args, entries);
        toolTrace.push({
          tool: call.name as string,
          args,
          resultSummary: summarizeToolResult(result),
        });
        inputItems.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result),
        });
      }

      if (callIndex >= aiSettings.playerProfileMaxCalls) {
        break;
      }

      response = await callResponsesApi(config, {
        instructions,
        input: inputItems,
        tools: AGENT_TOOLS,
        tool_choice: "required",
      }, aiSettings);
    }

    throw new Error(
      "Player profile agent exceeded its step budget without finishing.",
    );
  } catch (error) {
    await markAiBudgetFailed(budget.reservation, error);
    throw error;
  }
}

export type StoredPlayerProfile = {
  isLocalized: boolean;
  locale: Locale | null;
  summary: string;
  payload: PlayerProfilePayload;
  toolTrace: PlayerProfileToolTraceStep[];
  model: string | null;
  status: string;
  updatedAt: Date;
};

export async function getPlayerProfileForUser(
  userId: string,
  locale: Locale = "en",
): Promise<StoredPlayerProfile | null> {
  const record = await prisma.playerProfile.findUnique({ where: { userId } });
  if (!record) {
    return null;
  }

  const parsedPayload = PlayerProfilePayloadSchema.safeParse(record.profile);
  if (!parsedPayload.success) {
    return null;
  }

  const trace = Array.isArray(record.toolTrace)
    ? (record.toolTrace as PlayerProfileToolTraceStep[])
    : [];

  return {
    isLocalized: parsedPayload.data.language === locale,
    locale: parsedPayload.data.language ?? null,
    summary: record.summary,
    payload: parsedPayload.data,
    toolTrace: trace,
    model: record.model,
    status: record.status,
    updatedAt: record.updatedAt,
  };
}

export async function savePlayerProfile(
  userId: string,
  result: Extract<PlayerProfileAgentResult, { status: "COMPLETED" }>,
) {
  await prisma.playerProfile.upsert({
    where: { userId },
    update: {
      summary: result.payload.summary,
      profile: result.payload as Prisma.InputJsonValue,
      toolTrace: result.toolTrace as unknown as Prisma.InputJsonValue,
      model: result.model,
      status: "COMPLETED",
      error: null,
    },
    create: {
      userId,
      summary: result.payload.summary,
      profile: result.payload as Prisma.InputJsonValue,
      toolTrace: result.toolTrace as unknown as Prisma.InputJsonValue,
      model: result.model,
      status: "COMPLETED",
    },
  });
}

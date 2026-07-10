import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listGamesArgsSchema,
  loadLibraryEntries,
  runGenreStats,
  runLibraryOverview,
  runListGames,
  runPlayerFeedback,
} from "@/lib/assistant/library-tools";
import {
  recordAssistantChatRun,
} from "@/lib/assistant/queries";
import {
  markAiBudgetFailed,
  markAiBudgetUsed,
  reserveAiBudget,
} from "@/lib/ai-budget";
import { getAiSettings } from "@/lib/ai-settings";
import { estimateTokensFromValue } from "@/lib/ai-estimates";
import { getSessionUserId } from "@/lib/session";
import { getOpenAiConfig } from "@/lib/openai";
import { getRequestLocale } from "@/lib/request-locale";
import { getAiOutputLanguageInstruction } from "@/lib/ai-locale";

export const maxDuration = 60;

const MAX_HISTORY_MESSAGES = 20;

const CHAT_SYSTEM_PROMPT = [
  "You are the filazo library chat: a calm, concrete assistant for the user's own game collection.",
  "Use the tools to look at the user's real library before answering questions about it. Never invent games or stats.",
  "When you recommend playing something, recommend games already in their library and mention why, grounded in their playtime, feedback, or genre history.",
  "Reviews, abandon reasons, and favorites outweigh raw playtime when judging taste.",
  "Voice rule: gentle over gamified. Treat large libraries as abundance, not debt.",
  "Use display labels like on the shelf, still curious, playing now, credits rolled, and released.",
  "Avoid pressure, deadline, and task-list language, and never suggest that the user must finish a library.",
  "Keep answers short and skimmable.",
].join(" ");

export async function POST(request: Request) {
  const locale = await getRequestLocale();
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in before using the library chat." },
      { status: 401 },
    );
  }

  const aiSettings = await getAiSettings();
  if (!aiSettings.assistantChatEnabled) {
    return NextResponse.json(
      { error: "The library chat is disabled in admin settings." },
      { status: 503 },
    );
  }

  const config = getOpenAiConfig();
  if (!config) {
    return NextResponse.json(
      {
        error:
          "The AI module is unavailable. Set OPENAI_API_KEY or OPENROUTER_KEY to chat.",
      },
      { status: 503 },
    );
  }

  let messages: UIMessage[];
  try {
    const body = (await request.json()) as { messages?: UIMessage[] };
    if (!Array.isArray(body.messages) || !body.messages.length) {
      throw new Error("Missing messages.");
    }
    messages = body.messages.slice(-MAX_HISTORY_MESSAGES);
  } catch {
    return NextResponse.json(
      { error: "Invalid chat request." },
      { status: 400 },
    );
  }

  const budget = await reserveAiBudget({
    feature: "assistant_chat",
    estimatedInputTokens: estimateTokensFromValue(messages),
    estimatedOutputTokens: aiSettings.chatMaxOutputTokens,
    inputSummary: {
      maxSteps: aiSettings.chatMaxSteps,
      messageCount: messages.length,
    },
    model: config.model,
    userId,
  });
  if (!budget.allowed) {
    return NextResponse.json({ error: budget.message }, { status: 429 });
  }

  const entries = await loadLibraryEntries(userId);
  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });
  const modelName = config.model;

  const result = streamText({
    // Use the Chat Completions API (not the Responses API default): it is the
    // endpoint every OpenAI-compatible gateway, including OpenRouter, supports
    // across all models.
    model: openai.chat(modelName),
    system: `${CHAT_SYSTEM_PROMPT} ${getAiOutputLanguageInstruction(locale)}`,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: aiSettings.chatMaxOutputTokens,
    stopWhen: stepCountIs(aiSettings.chatMaxSteps),
    tools: {
      get_library_overview: tool({
        description:
          "High-level overview of the user's library: counts per status, favorites, feedback coverage, total playtime, top genres by playtime, and top platforms.",
        inputSchema: z.object({}),
        execute: async () => runLibraryOverview(entries),
      }),
      list_games: tool({
        description:
          "List games from the user's library with playtime, achievement progress, genres, and ratings. Filter by status and sort to inspect different slices.",
        inputSchema: listGamesArgsSchema,
        execute: async (args) => runListGames(entries, args),
      }),
      get_player_feedback: tool({
        description:
          "All games where the user left explicit feedback: written reviews/notes, abandon reasons, stated intents, or favorites. This is the strongest signal of taste.",
        inputSchema: z.object({}),
        execute: async () => runPlayerFeedback(entries),
      }),
      get_genre_stats: tool({
        description:
          "Per-genre aggregates: game count, total playtime, credits-rolled count, released count, and favorite count.",
        inputSchema: z.object({}),
        execute: async () => runGenreStats(entries),
      }),
    },
    onError: async ({ error }) => {
      await markAiBudgetFailed(budget.reservation, error);
    },
    onFinish: async ({ steps, totalUsage }) => {
      try {
        await markAiBudgetUsed(budget.reservation, {
          inputTokens: totalUsage.inputTokens ?? null,
          outputTokens: totalUsage.outputTokens ?? null,
          totalTokens: totalUsage.totalTokens ?? null,
        });
        await recordAssistantChatRun({
          userId,
          model: modelName,
          messageCount: messages.length,
          stepCount: steps.length,
          toolCallCount: steps.reduce(
            (total, step) => total + step.toolCalls.length,
            0,
          ),
          usage: {
            inputTokens: totalUsage.inputTokens ?? null,
            outputTokens: totalUsage.outputTokens ?? null,
            totalTokens: totalUsage.totalTokens ?? null,
          },
        });
      } catch (error) {
        console.error("Could not record library chat AI usage.", error);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}

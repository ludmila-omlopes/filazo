import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getOpenAiConfig } from "@/lib/openai";
import { AiBudgetExceededError, runWithAiBudget } from "@/lib/ai-budget";
import { MARKETPLACE_ESTIMATED_CALLS, marketplaceInputSchema, searchMarketplaces } from "@/lib/assistant/marketplace-search";

export const maxDuration = 90;

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const parsed = marketplaceInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  const config = getOpenAiConfig();
  if (!config) return NextResponse.json({ code: "NOT_CONFIGURED" }, { status: 503 });
  try {
    const result = await runWithAiBudget({
      userId,
      feature: "assistant_marketplace",
      countedCalls: MARKETPLACE_ESTIMATED_CALLS,
      model: config.model,
      estimatedInputTokens: 120000,
      estimatedOutputTokens: 40000,
      inputSummary: parsed.data,
      execute: () => searchMarketplaces(parsed.data, config, request.signal),
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AiBudgetExceededError) return NextResponse.json({ code: "AI_LIMIT" }, { status: 429 });
    console.error("Marketplace search failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ code: "SEARCH_FAILED" }, { status: 502 });
  }
}

import { prisma } from "../prisma.ts";
import { scoreBacklogEntries } from "./scoring.ts";
import { toAssistantEntry, writeRuleInsights } from "./queries.ts";

/**
 * Recomputes rule-based insights after a status change so recommendation
 * surfaces recover immediately without an AI call, release-cache refresh,
 * or AssistantRun row. Never throws: a scoring failure must not break the
 * user-facing mutation that triggered it.
 */
export async function recomputeRuleInsightsForUser(userId: string) {
  try {
    const entries = await prisma.userGameEntry.findMany({
      where: { userId },
      include: {
        game: {
          include: {
            providerLinks: true,
          },
        },
      },
    });
    const ruleInsights = scoreBacklogEntries(entries.map(toAssistantEntry));
    await writeRuleInsights(userId, ruleInsights);
  } catch (error) {
    console.error("recomputeRuleInsightsForUser failed", error);
  }
}

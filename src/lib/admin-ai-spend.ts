import { Prisma } from "@prisma/client";
import { getBudgetUsageFromRun, type AiBudgetFeature } from "./ai-budget";

type SpendBucket = { usedUsd: number; reservedUsd: number; failedUsd: number; usedRuns: number };
type SpendRow = {
  id: string;
  status: string;
  createdAt: Date;
  inputSummary: Prisma.JsonValue;
  outputSummary: Prisma.JsonValue;
};

const emptyBucket = (): SpendBucket => ({ usedUsd: 0, reservedUsd: 0, failedUsd: 0, usedRuns: 0 });

// Internal reader: called only after admin authorization, inside the dashboard's
// snapshot transaction and configured search_path. No prompts or responses are read.
export async function readAdminAiSpend(db: Prisma.TransactionClient, since: Date, now: Date, today: Date) {
  const total = emptyBucket();
  const features = new Map<AiBudgetFeature, SpendBucket>();
  let todayUsd = 0;
  let cursor: string | null = null;
  for (;;) {
    const rows: SpendRow[] = await db.$queryRaw(Prisma.sql`
      SELECT id, status, "createdAt",
        jsonb_build_object('kind', "inputSummary"->'kind', 'feature', "inputSummary"->'feature',
          'estimatedUsage', "inputSummary"->'estimatedUsage') AS "inputSummary",
        jsonb_build_object('output', jsonb_strip_nulls(jsonb_build_object(
          'inputTokens', "outputSummary"#>'{output,inputTokens}',
          'outputTokens', "outputSummary"#>'{output,outputTokens}',
          'totalTokens', "outputSummary"#>'{output,totalTokens}',
          'usage', CASE WHEN jsonb_typeof("outputSummary"#>'{output,usage}') = 'object'
            THEN jsonb_strip_nulls(jsonb_build_object(
              'inputTokens', "outputSummary"#>'{output,usage,inputTokens}',
              'outputTokens', "outputSummary"#>'{output,usage,outputTokens}',
              'totalTokens', "outputSummary"#>'{output,usage,totalTokens}'))
            ELSE NULL END))) AS "outputSummary"
      FROM "AssistantRun"
      WHERE "createdAt" >= ${since} AND "createdAt" <= ${now}
        AND status IN ('AI_BUDGET_USED', 'AI_BUDGET_RESERVED', 'AI_BUDGET_FAILED')
        AND "inputSummary"->>'kind' = 'ai_budget'
        ${cursor === null ? Prisma.empty : Prisma.sql`AND id > ${cursor}`}
      ORDER BY id LIMIT 500
    `);
    for (const row of rows) {
      const usage = getBudgetUsageFromRun(row);
      if (!usage) continue;
      const bucket = features.get(usage.feature) ?? emptyBucket();
      const key = row.status === "AI_BUDGET_USED" ? "usedUsd"
        : row.status === "AI_BUDGET_RESERVED" ? "reservedUsd" : "failedUsd";
      total[key] += usage.usd;
      bucket[key] += usage.usd;
      if (row.status === "AI_BUDGET_USED") {
        total.usedRuns++;
        bucket.usedRuns++;
        if (row.createdAt >= today) todayUsd += usage.usd;
      }
      features.set(usage.feature, bucket);
    }
    if (rows.length < 500) break;
    cursor = rows[rows.length - 1].id;
  }
  return { ...total, todayUsd, features: [...features].map(([feature, usage]) => ({ feature, ...usage }))
    .sort((a, b) => b.usedUsd - a.usedUsd || a.feature.localeCompare(b.feature)) };
}

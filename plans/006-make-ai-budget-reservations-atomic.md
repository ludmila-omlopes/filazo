# Plan 006: Make AI Budget Reservations Atomic

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 80086a6..HEAD -- src/lib/ai-budget.ts tests`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `80086a6`, 2026-07-03
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/98

## Why this matters

AI usage is controlled by per-user spend, token, call, and file limits, but the
reservation path currently reads usage and then creates a reservation as
separate database operations. Two concurrent requests can both observe the same
remaining budget and both reserve, exceeding configured limits. The code
already has retry logic for Prisma serializable conflicts, so the intended fix
is to make the check-and-create operation a single serializable transaction.

## Current state

- `src/lib/ai-budget.ts` owns AI feature gates, usage reads, reservations, and
  marking reservations used or failed.
- `src/lib/assistant/ai.ts`, `src/lib/journal.ts`,
  `src/lib/story-completion.ts`, `src/lib/assistant/profile-agent.ts`, and
  `src/app/api/assistant/chat/route.ts` call the budget layer before contacting
  an AI provider.

Current non-atomic flow:

```ts
// src/lib/ai-budget.ts:451-488
const settings = await getAiSettings();
...
const usage = await getBudgetUsage({ now, userId });
if (usage.daily.usd + estimatedUsd > settings.userDailySpendLimitUsd) {
  return {
    allowed: false as const,
    reason: "USER_DAILY_SPEND_LIMIT" as const,
    message: "Daily personal AI spend limit reached. Try again tomorrow.",
  };
}
...
const run = await prisma.assistantRun.create({
  data: {
    userId,
    inputSummary: { kind: "ai_budget", feature, groupId, ... },
    status: "AI_BUDGET_RESERVED",
  },
});
```

Existing retry scaffold:

```ts
// src/lib/ai-budget.ts:570-588
for (let attempt = 0; attempt < 3; attempt += 1) {
  try {
    return await reserveAiBudgetOnce({ ... });
  } catch (error) {
    if (isSerializableConflict(error) && attempt < 2) {
      continue;
    }
    throw error;
  }
}
```

Repo conventions to match:

- Keep AI feature behavior best-effort and fail with clear user-facing
  messages.
- Tests use Node's built-in runner with `node --experimental-strip-types
  --test`; model new tests after `src/lib/enrichment-policy.test.ts` and
  `src/lib/auth-secret.test.ts`.
- Keep Prisma access centralized through `src/lib/prisma.ts`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint | `npm run lint` | exit 0; existing `next/image` warnings may remain |
| Typecheck | `npm run typecheck` | exit 0, no TypeScript errors |
| Tests | `npm test` | exit 0, all tests pass |

## Scope

**In scope**:

- `src/lib/ai-budget.ts`
- `tests/ai-budget.test.mjs` or `src/lib/ai-budget.test.ts` (create)

**Out of scope**:

- Changing AI pricing estimates in `src/lib/ai-estimates.ts`
- Changing admin settings UI or schema
- Changing AI prompt behavior or provider calls
- Adding a global cross-user budget; this plan is only about making existing
  per-user and per-feature gates atomic

## Git workflow

- Branch: `codex/006-atomic-ai-budget-reservations`
- Commit message style: imperative, matching recent history such as
  `Restructure AI budget limits`
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make the budget usage reader transaction-client aware

In `src/lib/ai-budget.ts`, introduce a local Prisma client type that works with
both `prisma` and a transaction client. One acceptable shape:

```ts
type AiBudgetPrismaClient = Pick<typeof prisma, "assistantRun" | "aiSettings">;
```

Then update helpers that read AI usage/settings to accept an optional client:

- `getBudgetUsage({ now, userId, client = prisma })`
- either update `getAiSettings` call sites by reading `client.aiSettings` inside
  `ai-budget.ts`, or add a local helper such as
  `getAiSettingsWithClient(client)`.

Do not change the public return shapes from `getAiBudgetUsageForUser`,
`reserveAiBudget`, `markAiBudgetUsed`, or `markAiBudgetFailed`.

**Verify**: `npm run typecheck` -> exit 0.

### Step 2: Wrap reservation check and create in a serializable transaction

Change `reserveAiBudgetOnce` so settings reads, usage reads, all limit checks,
and `assistantRun.create` execute inside:

```ts
return prisma.$transaction(
  async (tx) => {
    // read settings and usage through tx
    // evaluate limits
    // create the AI_BUDGET_RESERVED AssistantRun
    // return the existing AiBudgetReserveResult shape
  },
  { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
);
```

Keep the existing `isSerializableConflict` retry loop in `reserveAiBudget`.
Remove the unreachable fallback call after the retry loop, or replace it with a
throw that TypeScript can understand; do not leave duplicate fourth-attempt
reservation logic.

**Verify**:
`rg -n "TransactionIsolationLevel.Serializable|reserveAiBudgetOnce|for \\(let attempt" src/lib/ai-budget.ts`
-> shows the serializable transaction and the retry loop.

### Step 3: Add focused tests for budget math and counted statuses

Add a small test file for pure logic extracted during Step 1 if needed. At
minimum, cover:

- a reservation is rejected when daily spend would exceed
  `userDailySpendLimitUsd`;
- a reservation is rejected when `assistant_chat` would exceed
  `chatDailyTokenLimit`;
- failed and reserved statuses are counted by usage, matching
  `AI_BUDGET_COUNTED_STATUSES`.

If testing requires extraction, export only narrow helpers with names that make
their production usefulness clear, such as `readAiBudgetUsageForRun` or
`getAiBudgetCountedStatuses`. Do not introduce a mocking framework.

**Verify**: `npm test` -> all tests pass, including the new budget tests.

### Step 4: Run full verification

Run the standard checks.

**Verify**:

- `npm run lint` -> exit 0; existing `next/image` warnings may remain.
- `npm run typecheck` -> exit 0.
- `npm test` -> exit 0.

## Test plan

- Add budget-layer tests in `tests/ai-budget.test.mjs` or
  `src/lib/ai-budget.test.ts`.
- Model structure after existing Node runner tests, using `node:test` and
  `node:assert/strict`.
- The tests should prove the limit math and counted statuses used by the
  transaction path; the database isolation itself is verified by code shape
  (`Serializable` transaction plus existing `P2034` retry).

## Done criteria

- [ ] `reserveAiBudgetOnce` performs read-check-create inside a Prisma
  serializable transaction.
- [ ] Existing `P2034` retry behavior is preserved.
- [ ] The unreachable fourth reservation attempt after the retry loop is gone.
- [ ] New tests cover spend, token, and counted-status behavior.
- [ ] `npm run lint`, `npm run typecheck`, and `npm test` exit 0.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- `src/lib/ai-budget.ts` no longer contains `reserveAiBudgetOnce`,
  `reserveAiBudget`, or the `P2034` retry loop shown above.
- Prisma rejects `TransactionIsolationLevel.Serializable` for this project.
- The fix appears to require changing AI settings schema or user-facing budget
  semantics.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Any future AI feature that reserves budget should continue to call this layer
instead of duplicating budget checks. Reviewers should scrutinize whether all
reads inside the reservation decision use the transaction client; a single
global `prisma` read inside the transaction can reintroduce the race.

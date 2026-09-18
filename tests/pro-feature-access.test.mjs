import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { z } from "zod";
import { hasProAccess } from "../src/lib/account-plans.ts";
import { getPlanLimits } from "../src/lib/plan-policy.ts";
import { createTranslator } from "../src/lib/i18n.ts";
const require = createRequire(import.meta.url);

function load(path, mocks) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  new Function("require", "exports", outputText)((name) => {
    if (name in mocks) return mocks[name];
    // Unused feature imports are inert; any unexpected call fails immediately.
    if (name.startsWith("@/")) return {};
    return require(name);
  }, exports);
  return exports;
}

test("direct calendar mutations deny Free and authenticate owner and Pro during the write", async () => {
  let account = { plan: "FREE" };
  let writes = 0;
  const predicate = { OR: [{ plan: "PRO" }] };
  const actions = load("../src/app/profile/actions.ts", {
    "@/lib/account-plans": { hasProAccess },
    "@/lib/plan-access": { getPlanAccount: async () => account, proAccountWhere: () => predicate },
    "@/lib/session": { getSessionUserId: async () => "user-a" },
    "next/navigation": { redirect: url => { throw Error(`redirect:${url}`); } },
    "next/cache": { revalidatePath() {} },
    "@/lib/prisma": { prisma: { userGameEntry: { updateMany: async args => {
      assert.equal(args.where.userId, "user-a");
      assert.deepEqual(args.where.user, predicate);
      writes++; return { count: 1 };
    } } } },
  });
  const form = new FormData();
  form.set("entryId", "cjld2cjxh0000qzrmn831i7rn");
  form.set("plannedStartDate", "2026-10-01");
  await assert.rejects(actions.savePlayingNextDateAction(form), /redirect:\/account\/billing/);
  assert.equal(writes, 0);
  account = { plan: "PRO" };
  await actions.savePlayingNextDateAction(form);
  assert.equal(writes, 1);
});

test("Free chat has no search tool; Pro can search and expiry blocks execution", async () => {
  let account = { plan: "FREE" };
  let options;
  let searches = 0;
  const route = load("../src/app/api/assistant/chat/route.ts", {
    "@ai-sdk/openai": { createOpenAI: () => ({ chat: () => ({}) }) },
    ai: { convertToModelMessages: async messages => messages, stepCountIs: () => ({}), tool: value => value,
      streamText: value => { options = value; return { toUIMessageStreamResponse: () => new Response("ok") }; } },
    "@/lib/session": { getSessionUserId: async () => "user-a" },
    "@/lib/plan-access": { getPlanAccount: async () => account },
    "@/lib/plan-policy": { getPlanLimits },
    "@/lib/request-locale": { getRequestLocale: async () => "pt-BR" },
    "@/lib/ai-locale": { getAiOutputLanguageInstruction: () => "Portuguese" },
    "@/lib/abuse-policy": { ABUSE_LIMITS: { assistant: {} } },
    "@/lib/abuse-request": { checkApiAbuse: async () => null },
    "@/lib/request-body": { readLimitedJson: request => request.json() },
    "@/lib/ai-settings": { getAiSettings: async () => ({ assistantChatEnabled: true, chatMaxSteps: 3, chatMaxOutputTokens: 700 }) },
    "@/lib/openai": { getOpenAiConfig: () => ({ apiKey: "fixture", model: "fixture" }) },
    "@/lib/ai-estimates": { estimateTokensFromValue: () => 1 },
    "@/lib/ai-budget": { reserveAiBudget: async () => ({ allowed: true, reservation: {} }), markAiBudgetUsed: async () => {} },
    "@/lib/assistant/library-tools": { loadLibraryEntries: async () => [], listGamesArgsSchema: z.object({}) },
    "@/lib/assistant/web-search": {
      webSearchArgsSchema: z.object({ query: z.string() }), isWebSearchSupported: () => true,
      unavailableWebSearch: reason => ({ status: "unavailable", reason }),
      searchWeb: async () => { searches++; return { result: { status: "ok" }, usage: {} }; },
    },
  });
  const request = () => new Request("http://localhost/api/assistant/chat", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", parts: [{ type: "text", text: "search games" }] }] }) });
  assert.equal((await route.POST(request())).status, 200);
  assert.equal(options.tools.search_web, undefined);
  account = { plan: "PRO" };
  await route.POST(request());
  await options.tools.search_web.execute({ query: "game releases" }, {});
  assert.equal(searches, 1);
  await route.POST(request());
  account = { plan: "FREE" };
  assert.equal((await options.tools.search_web.execute({ query: "games" }, {})).status, "unavailable");
  assert.equal(searches, 1);
});

test("storage quota errors preserve a useful localized response from the diary action", async () => {
  class JournalStorageLimitError extends Error {}
  const { planCopy } = await import("../src/lib/plan-copy.ts");
  const action = load("../src/app/profile/journal-actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/session": { getSessionUserId: async () => "user-a" },
    "@/lib/i18n": { createTranslator },
    "@/lib/request-locale": { getRequestLocale: async () => "pt-BR" },
    "@/lib/plan-access": { JournalStorageLimitError },
    "@/lib/plan-copy": { planCopy },
    "@/lib/journal": { createJournalEntryForUser: async () => { throw new JournalStorageLimitError(); } },
  });
  const form = new FormData();
  form.set("userGameEntryId", "fixture"); form.set("body", "My memory");
  assert.equal((await action.saveJournalPageAction(form)).error, planCopy("pt-BR").storageFull);
});

test("retrospectives deny Free before reading memories and scope every Pro query to the session", async () => {
  const { planCopy } = await import("../src/lib/plan-copy.ts");
  let account = { plan: "FREE" };
  let reads = 0;
  function Gate() { return null; }
  const page = load("../src/app/account/retrospective/page.tsx", {
    "@/lib/session": { getSessionUserId: async () => "user-a" },
    "@/lib/beta-access": { requirePlatformAccess: async () => account },
    "@/lib/account-plans": { hasProAccess },
    "@/lib/request-locale": { getRequestLocale: async () => "pt-BR" },
    "@/lib/plan-copy": { planCopy },
    "@/components/pro-feature-gate": { ProFeatureGate: Gate },
    "@/lib/prisma": { prisma: { gameJournalEntry: {
      findFirst: async args => { reads++; assert.equal(args.where.userId, "user-a"); return null; },
      findMany: async args => { reads++; assert.equal(args.where.userId, "user-a"); assert.equal(args.take, 25); assert.equal(args.where.OR, undefined); return []; },
    } } },
  }).default;
  const query = { searchParams: Promise.resolve({ year: "2026", before: "someone-elses-memory" }) };
  assert.equal((await page(query)).props.children.type, Gate);
  assert.equal(reads, 0);
  account = { plan: "PRO" };
  await page(query);
  assert.equal(reads, 2);
});

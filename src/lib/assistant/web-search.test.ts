import assert from "node:assert/strict";
import { test } from "node:test";
import { budgetBlockedWebSearch, getWebSearchStatusKey, searchWeb, unavailableWebSearch, webSearchArgsSchema, webSearchResultSchema } from "./web-search.ts";
import type { OpenAiConfig } from "../openai.ts";

const config: OpenAiConfig = {
  apiKey: "test-key",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "openai/gpt-5.4-mini",
  provider: "openrouter",
};
const citation = { type: "url_citation", url_citation: { url: "https://example.com/announcement", title: "Announcement" } };

test("insufficient search quota is a distinct result with a precise UI message", () => {
  const result = budgetBlockedWebSearch("FEATURE_DAILY_TOKEN_LIMIT");
  assert.equal(webSearchResultSchema.safeParse(result).success, true);
  assert.equal(result.status, "budget_exceeded");
  assert.equal(result.budgetReason, "FEATURE_DAILY_TOKEN_LIMIT");
  assert.equal(getWebSearchStatusKey(result), "libraryChat.webTokenLimit");
  assert.match(result.summary, /NOT sent/);
  assert.match(result.summary, /5600 tokens/);
  assert.match(result.summary, /not a web outage/);
  assert.match(result.summary, /rolling window/);
  assert.deepEqual(result.sources, []);
});

test("spend caps and disabled features do not appear as provider failures", () => {
  assert.equal(getWebSearchStatusKey(budgetBlockedWebSearch("USER_DAILY_SPEND_LIMIT")), "libraryChat.webSpendLimit");
  const disabled = budgetBlockedWebSearch("FEATURE_DISABLED");
  assert.equal(getWebSearchStatusKey(disabled), "libraryChat.webDisabled");
  assert.match(disabled.summary, /administrator must enable/);
  assert.equal(getWebSearchStatusKey(budgetBlockedWebSearch("FEATURE_DAILY_CALL_LIMIT")), "libraryChat.webUsageLimit");
  assert.equal(getWebSearchStatusKey(unavailableWebSearch()), "libraryChat.webUnavailable");
  assert.equal(getWebSearchStatusKey({ status: "no_sources", summary: "", sources: [] }), "libraryChat.webNoSources");
  assert.equal(getWebSearchStatusKey({ status: "limit_reached", summary: "", sources: [] }), "libraryChat.webReplyLimit");
});

test("OpenRouter search uses the configured model and a bounded web plugin request", async () => {
  const { result, usage } = await searchWeb({
    config, query: "  God of War Laufey  ",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, config.model);
      assert.deepEqual(body.plugins, [{ id: "web", engine: "exa", max_results: 5 }]);
      assert.equal(body.messages.length, 2);
      assert.equal(body.messages[1].content, "God of War Laufey");
      assert.equal(body.stream, false);
      assert.equal(init?.cache, "no-store");
      assert.ok(init?.signal);
      return Response.json({ choices: [{ message: { content: "Confirmed announcement.", annotations: [citation, citation] } }], usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 } });
    },
  });
  assert.equal(result.status, "ok");
  assert.deepEqual(result.sources, [citation.url_citation]);
  assert.deepEqual(usage, { inputTokens: 120, outputTokens: 30, totalTokens: 150 });
});

test("direct OpenAI requires a web search and parses Responses citations", async () => {
  const { result } = await searchWeb({
    config: { ...config, provider: "openai", baseUrl: "https://api.openai.com/v1", model: "gpt-5.4-mini" },
    query: "God of War announcement",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.tool_choice, "required");
      assert.equal(body.max_tool_calls, 1);
      assert.equal(body.store, false);
      assert.equal(body.tools[0].type, "web_search");
      return Response.json({ status: "completed", output: [
        { type: "web_search_call" },
        { type: "message", content: [{ type: "output_text", text: "Announcement.", annotations: [{ type: "url_citation", ...citation.url_citation }] }] },
      ] });
    },
  });
  assert.equal(result.status, "ok");
  assert.deepEqual(result.sources, [citation.url_citation]);
});

test("uncited model responses never count as verified search results", async () => {
  const { result } = await searchWeb({ config, query: "Laufey game", fetchImpl: async () => Response.json({ choices: [{ message: { content: "An unsupported guess." } }] }) });
  assert.equal(result.status, "no_sources");
  assert.ok(!result.summary.includes("unsupported guess"));
  assert.deepEqual(result.sources, []);
});

test("search rejects unsafe citations and caps the displayed source list", async () => {
  const annotations = ["not a URL", "javascript:alert(1)", "https://user:secret@example.com", ...Array.from({ length: 8 }, (_, i) => `https://example.com/${i}`)]
    .map((url) => ({ type: "url_citation", url_citation: { url, title: "Source" } }));
  const { result } = await searchWeb({ config, query: "Laufey game", fetchImpl: async () => Response.json({ choices: [{ message: { content: "Summary.", annotations } }] }) });
  assert.equal(result.sources.length, 5);
  assert.equal(result.sources[0].url, "https://example.com/0");
  assert.equal(webSearchResultSchema.safeParse({ status: "ok", summary: "", sources: [{ title: "Unsafe", url: "javascript:alert(1)" }] }).success, false);
});

test("provider errors do not leak their bodies", async () => {
  await assert.rejects(searchWeb({ config, query: "Laufey game", fetchImpl: async () => new Response("secret provider details", { status: 429 }) }), /^Error: Web search provider returned status 429\.$/);
});

test("provider failure envelopes and incomplete responses are rejected", async () => {
  for (const data of [{ error: { message: "private details" } }, { status: "incomplete" }]) {
    await assert.rejects(searchWeb({ config, query: "Laufey game", fetchImpl: async () => Response.json(data) }), /did not complete/);
  }
});

test("invalid queries and unsupported gateways make no request", async () => {
  assert.equal(webSearchArgsSchema.safeParse({ query: " " }).success, false);
  assert.equal(webSearchArgsSchema.safeParse({ query: "a".repeat(301) }).success, false);
  await assert.rejects(searchWeb({ config: { ...config, provider: "compatible" }, query: "Laufey game", fetchImpl: async () => { throw new Error("unexpected fetch"); } }), /unavailable for this AI gateway/);
});

test("caller cancellation reaches the search request", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(searchWeb({ config, query: "Laufey game", signal: controller.signal, fetchImpl: async (_url, init) => { init?.signal?.throwIfAborted(); throw new Error("unexpected fetch"); } }), { name: "AbortError" });
});

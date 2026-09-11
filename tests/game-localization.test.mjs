import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";
import { localizeGameGenre } from "../src/lib/game-localization.ts";

const require = createRequire(import.meta.url);
const source = readFileSync(
  new URL("../src/lib/game-summary-translation.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

function harness({
  cached = null,
  configured = true,
  incomplete = false,
  denied = false,
} = {}) {
  const calls = [];
  const mocks = {
    "./prisma": {
      prisma: {
        assistantRun: {
          findFirst: async (query) => {
            calls.push(["cache", query]);
            return cached;
          },
          create: async (query) => {
            calls.push(["store", query]);
          },
        },
      },
    },
    "./openai": {
      getOpenAiConfig: () =>
        configured
          ? {
              model: "test",
              apiKey: "test-key",
              baseUrl: "https://test.invalid",
            }
          : null,
    },
    "./ai-settings": {
      getAiSettings: async () => ({
        assistantSummaryEnabled: true,
        assistantSummaryMaxOutputTokens: 650,
      }),
    },
    "./ai-budget": {
      runWithAiBudget: async (options) => {
        calls.push(["budget", options]);
        if (denied) throw new Error("Budget exhausted");
        return options.execute();
      },
    },
  };
  const exports = {};
  new Function("require", "exports", "fetch", compiled)(
    (name) => mocks[name] ?? require(name),
    exports,
    async (_url, options) => {
      calls.push(["fetch", JSON.parse(options.body)]);
      return {
        ok: true,
        json: async () => ({
          status: incomplete ? "incomplete" : "completed",
          output: [
            {
              content: [
                { type: "output_text", text: "Uma aventura por turnos." },
              ],
            },
          ],
        }),
      };
    },
  );
  return { ...exports, calls };
}

const input = {
  gameId: "canonical-game",
  summary: "A turn-based adventure.",
  locale: "pt-BR",
  userId: "owner",
};

test("genres follow the selected locale and retain unrecognized labels", () => {
  assert.equal(localizeGameGenre("Adventure", "pt-BR"), "Aventura");
  assert.equal(
    localizeGameGenre("Turn-based strategy (TBS)", "pt-BR"),
    "Estratégia por turnos",
  );
  assert.equal(localizeGameGenre("Role-playing (RPG)", "pt-BR"), "RPG");
  assert.equal(localizeGameGenre("Adventure", "en"), "Adventure");
  assert.equal(localizeGameGenre("Unknown genre", "pt-BR"), "Unknown genre");
});

test("English and signed-out visits do not use AI or write cache records", async () => {
  const service = harness();
  assert.equal(
    await service.getTranslatedGameSummary({ ...input, locale: "en" }),
    input.summary,
  );
  assert.equal(
    await service.getTranslatedGameSummary({ ...input, userId: null }),
    null,
  );
  assert.deepEqual(service.calls, []);
});

test("cached translations are scoped to the signed-in user and reused without AI", async () => {
  const service = harness({
    cached: { outputSummary: { text: "Já traduzido." } },
  });
  assert.equal(await service.getTranslatedGameSummary(input), "Já traduzido.");
  assert.equal(service.calls.length, 1);
  assert.equal(service.calls[0][1].where.userId, "owner");
  const key = service.gameSummaryTranslationKey(
    input.gameId,
    input.summary,
    input.locale,
  );
  assert.equal(service.calls[0][1].where.inputSummary.equals, key);
  assert.notEqual(
    key,
    service.gameSummaryTranslationKey(
      input.gameId,
      "Updated synopsis",
      input.locale,
    ),
  );
  assert.notEqual(
    key,
    service.gameSummaryTranslationKey(
      "another-game",
      input.summary,
      input.locale,
    ),
  );
  assert.notEqual(
    key,
    service.gameSummaryTranslationKey(input.gameId, input.summary, "en"),
  );
});

test("new translations respect AI budget and output settings without changing the source", async () => {
  const service = harness();
  assert.equal(
    await service.getTranslatedGameSummary(input),
    "Uma aventura por turnos.",
  );
  const budget = service.calls.find(([kind]) => kind === "budget")[1];
  assert.equal(budget.userId, "owner");
  assert.equal(budget.feature, "assistant_summary");
  const request = service.calls.find(([kind]) => kind === "fetch")[1];
  assert.equal(request.max_output_tokens, 650);
  assert.equal(request.input[1].content, input.summary);
  assert.match(request.input[0].content, /Brazilian Portuguese/);
  const stored = service.calls.find(([kind]) => kind === "store")[1].data;
  assert.equal(stored.inputSummary.gameId, "canonical-game");
  assert.equal(stored.status, "GAME_SUMMARY_TRANSLATED");
  assert.equal(stored.outputSummary.text, "Uma aventura por turnos.");
});

test("missing configuration, budget failures, and incomplete translations never populate the cache", async () => {
  const unavailable = harness({ configured: false });
  assert.equal(await unavailable.getTranslatedGameSummary(input), null);
  assert.equal(
    unavailable.calls.some(([kind]) => kind === "fetch"),
    false,
  );
  for (const options of [{ incomplete: true }, { denied: true }]) {
    const service = harness(options);
    await assert.rejects(service.getTranslatedGameSummary(input));
    assert.equal(
      service.calls.some(([kind]) => kind === "store"),
      false,
    );
    if (options.denied)
      assert.equal(
        service.calls.some(([kind]) => kind === "fetch"),
        false,
      );
  }
});

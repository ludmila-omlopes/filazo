import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";
import { matchesJournalSearch } from "../src/lib/journal-search.ts";

const require = createRequire(import.meta.url);

// Load the real services with isolated dependencies; no database or provider calls.
function loadModule(relativePath, mocks) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const exports = {};
  new Function("require", "exports", outputText)((name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/") || name.startsWith("./")) return {};
    return require(name);
  }, exports);
  return exports;
}

const edit = {
  userId: "owner",
  userGameEntryId: "game-entry",
  journalEntryId: "page",
  title: "Revised",
  body: "A memory",
  occurredAt: null,
};

test("editing scopes both lookup and update to the owner, game entry, and page", async () => {
  const calls = [];
  const journal = loadModule("../src/lib/journal.ts", {
    "@/lib/prisma": {
      prisma: {
        gameJournalEntry: {
          findFirst: async (args) => {
            calls.push(args);
            return {
              audioTranscript: "voice",
              media: [{ id: "image" }],
              game: { slug: "game" },
            };
          },
          updateMany: async (args) => {
            calls.push(args);
            return { count: 1 };
          },
        },
      },
    },
  });
  assert.equal(await journal.updateJournalEntryForUser(edit), "game");
  const where = { id: "page", userId: "owner", userGameEntryId: "game-entry" };
  assert.deepEqual(calls[0].where, where);
  assert.deepEqual(calls[1], {
    where,
    data: { title: "Revised", body: "A memory" },
  });
});

test("a missing or unauthorized diary page cannot be edited", async () => {
  let mutated = false;
  const journal = loadModule("../src/lib/journal.ts", {
    "@/lib/prisma": {
      prisma: {
        gameJournalEntry: {
          findFirst: async () => null,
          updateMany: async () => {
            mutated = true;
            return { count: 1 };
          },
        },
      },
    },
  });
  await assert.rejects(journal.updateJournalEntryForUser(edit));
  assert.equal(mutated, false);
});

test("editing cannot empty a text-only page but accepts pages with existing media", async () => {
  let media = [];
  let mutations = 0;
  const journal = loadModule("../src/lib/journal.ts", {
    "@/lib/prisma": {
      prisma: {
        gameJournalEntry: {
          findFirst: async () => ({
            audioTranscript: null,
            media,
            game: { slug: "game" },
          }),
          updateMany: async () => {
            mutations++;
            return { count: 1 };
          },
        },
      },
    },
  });
  await assert.rejects(
    journal.updateJournalEntryForUser({ ...edit, title: null, body: null }),
  );
  assert.equal(mutations, 0);
  media = [{ id: "audio" }];
  await journal.updateJournalEntryForUser({ ...edit, title: null, body: null });
  assert.equal(mutations, 1);
});

function actionHarness(userId = "owner") {
  const calls = [];
  const actions = loadModule("../src/app/profile/journal-actions.ts", {
    "next/cache": {
      revalidatePath: (path) => calls.push(["revalidate", path]),
    },
    "@/lib/request-locale": { getRequestLocale: async () => "pt-BR" },
    "@/lib/session": { getSessionUserId: async () => userId },
    "@/lib/i18n": { createTranslator: () => (key) => key },
    "@/lib/journal": {
      createJournalEntryForUser: async (data) => calls.push(["create", data]),
      updateJournalEntryForUser: async (data) => {
        calls.push(["update", data]);
        return "game";
      },
    },
  });
  return { ...actions, calls };
}

function form(values = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    userGameEntryId: "game-entry",
    title: "Memory",
    ...values,
  }))
    data.set(key, value);
  return data;
}

test("save refuses signed-out requests, oversized text, invalid dates, and empty pages", async () => {
  const signedOut = actionHarness(null);
  assert.ok((await signedOut.saveJournalPageAction(form())).error);
  assert.equal(signedOut.calls.length, 0);
  const actions = actionHarness();
  for (const values of [
    { title: "x".repeat(161) },
    { body: "x".repeat(4001) },
    { occurredAt: "invalid" },
    { title: " " },
  ]) {
    assert.ok((await actions.saveJournalPageAction(form(values))).error);
  }
  assert.equal(actions.calls.length, 0);
});

test("save uses the session owner and preserves the submitted timezone", async () => {
  const actions = actionHarness();
  const result = await actions.saveJournalPageAction(
    form({
      userId: "other-user",
      journalEntryId: "page",
      occurredAt: "2026-09-11T10:30:00-03:00",
    }),
  );
  assert.equal(result.success, true);
  assert.equal(actions.calls[0][0], "update");
  assert.equal(actions.calls[0][1].userId, "owner");
  assert.equal(
    actions.calls[0][1].occurredAt.toISOString(),
    "2026-09-11T13:30:00.000Z",
  );
  assert.deepEqual(actions.calls.slice(1), [
    ["revalidate", "/profile"],
    ["revalidate", "/games/game"],
  ]);
});

test("journal search ignores accents and case and finds words across page fields", () => {
  assert.equal(
    matchesJournalSearch(
      "  DIFICIL sapos ",
      "Mais difícil",
      "Uma dungeon de sapos",
    ),
    true,
  );
  assert.equal(
    matchesJournalSearch("diapasao", null, "Achar um diapasão"),
    true,
  );
  assert.equal(matchesJournalSearch("magus", "Celeste", "Montanha"), false);
  assert.equal(matchesJournalSearch("", null), true);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(path, mocks) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  new Function("require", "exports", outputText)(name => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`);
    return mocks[name];
  }, exports);
  return exports;
}

function fixture({ found = true, count = 1, storageError = false } = {}) {
  const calls = [];
  const media = { storageKey: "fixture", storageProvider: "filesystem" };
  const tx = { userGameEntry: {
    findFirst: async ({ where }) => {
      assert.deepEqual(where, { id: "copy-pc", userId: "owner" });
      calls.push("read");
      return found ? { journalEntries: [{ media: [media] }] } : null;
    },
    deleteMany: async ({ where }) => {
      assert.deepEqual(where, { id: "copy-pc", userId: "owner" });
      calls.push("delete");
      return { count };
    },
  } };
  const service = load("../src/lib/remove-library-entry.ts", {
    "@/lib/prisma": { prisma: { $transaction: async fn => {
      const value = await fn(tx);
      calls.push("commit");
      return value;
    } } },
    "@/lib/library-entry": { lockLibraryGame: async (client, userId) => {
      assert.equal(client, tx);
      assert.equal(userId, "owner");
      calls.push("lock");
    } },
    "@/lib/journal": { removeUploadedFile: async value => {
      assert.deepEqual(value, media);
      calls.push("storage");
      if (storageError) throw new Error("Storage unavailable");
    } },
  });
  return { ...service, calls };
}

test("removal scopes both read and write to owner and copy; media cleanup follows commit", async () => {
  const f = fixture();
  assert.equal(await f.removeLibraryEntry("owner", "copy-pc"), true);
  assert.deepEqual(f.calls, ["lock", "read", "delete", "commit", "storage"]);
});

test("missing or foreign copy does not delete records or files", async () => {
  const f = fixture({ found: false });
  assert.equal(await f.removeLibraryEntry("owner", "copy-pc"), false);
  assert.deepEqual(f.calls, ["lock", "read", "commit"]);
});

test("ownership change at write time cannot trigger file cleanup", async () => {
  const f = fixture({ count: 0 });
  assert.equal(await f.removeLibraryEntry("owner", "copy-pc"), false);
  assert.ok(!f.calls.includes("storage"));
});

test("storage failure does not report a committed deletion as failed", async () => {
  const f = fixture({ storageError: true });
  assert.equal(await f.removeLibraryEntry("owner", "copy-pc"), true);
});

function actionFixture(userId = "owner", fail = false) {
  const writes = [];
  const refreshed = [];
  const actions = load("../src/app/profile/remove-library-actions.ts", {
    "next/cache": { revalidatePath: path => refreshed.push(path) },
    "@/lib/session": { getSessionUserId: async () => userId },
    "@/lib/remove-library-entry": { removeLibraryEntry: async (...args) => {
      writes.push(args);
      if (fail) throw new Error("Database unavailable");
      return true;
    } },
    "@/lib/assistant/insight-maintenance": { recomputeRuleInsightsForUser: async () => { throw new Error("Derived refresh failed"); } },
  });
  return { ...actions, writes, refreshed };
}

function form(confirmed = "yes") {
  const data = new FormData();
  data.set("entryId", "copy-pc");
  data.set("userId", "attacker-supplied-owner");
  data.set("confirmed", confirmed);
  return data;
}

test("action requires authenticated user, valid entry and confirmation", async () => {
  for (const [userId, data] of [[null, form()], ["owner", form("no")], ["owner", new FormData()]]) {
    const f = actionFixture(userId);
    assert.deepEqual(await f.removeLibraryEntryAction({ result: "" }, data), { result: "error" });
    assert.equal(f.writes.length, 0);
  }
});

test("action takes ownership from session and refreshes dependent surfaces despite insight error", async () => {
  const f = actionFixture();
  assert.deepEqual(await f.removeLibraryEntryAction({ result: "" }, form()), { result: "removed" });
  assert.deepEqual(f.writes, [["owner", "copy-pc"]]);
  assert.deepEqual(f.refreshed, ["/profile", "/tonight", "/games/[slug]", "/"]);
});

test("database failure returns a recoverable error without claiming success", async () => {
  const f = actionFixture("owner", true);
  assert.deepEqual(await f.removeLibraryEntryAction({ result: "" }, form()), { result: "error" });
  assert.deepEqual(f.refreshed, []);
});

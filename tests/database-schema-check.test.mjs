import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDatabaseSchema, shouldCheckDatabase } from "../scripts/database-schema-check.mjs";

const datamodel = {
  models: [{ name: "Game", fields: [{ name: "id", kind: "scalar" }, { name: "completionModel", kind: "enum" }, { name: "links", kind: "object" }] }],
  enums: [{ name: "GameCompletionModel", values: [{ name: "UNKNOWN" }, { name: "ONGOING" }] }],
};

test("deployments cannot skip schema verification by omitting the database URL", () => {
  assert.throws(() => shouldCheckDatabase({ VERCEL: "1" }), /DATABASE_URL/);
  assert.equal(shouldCheckDatabase({}), false);
  assert.equal(shouldCheckDatabase({ DATABASE_URL: "postgresql://host/db" }), true);
});

test("schema guard resolves columns without reading user rows and rejects a missing column", async () => {
  await assert.rejects(checkDatabaseSchema({
    async $queryRawUnsafe(sql) {
      assert.equal(sql, 'SELECT "id", "completionModel" FROM "public"."Game" LIMIT 0');
      throw new Error("column missing");
    },
  }, datamodel), /column missing/);
});

test("schema guard rejects missing enum values and accepts a compatible schema", async () => {
  const values = [{ name: "GameCompletionModel", value: "UNKNOWN" }];
  const client = { async $queryRawUnsafe(sql) { return sql.includes("pg_enum") ? values : []; } };
  await assert.rejects(checkDatabaseSchema(client, datamodel), /ONGOING/);
  values.push({ name: "GameCompletionModel", value: "ONGOING" });
  await checkDatabaseSchema(client, datamodel);
});

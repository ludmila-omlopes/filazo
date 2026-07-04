import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCsvColumnMappingJson } from "../src/lib/csv-import-mapping.ts";

test("CSV import mapping accepts known columns and trims optional blanks", () => {
  const mapping = parseCsvColumnMappingJson(
    JSON.stringify({
      title: "Name",
      platform: " ",
      status: "State",
      provider: "PLAYSTATION",
    }),
  );

  assert.deepEqual(mapping, {
    title: "Name",
    status: "State",
    provider: "PLAYSTATION",
  });
});

test("CSV import mapping rejects invalid JSON", () => {
  assert.equal(parseCsvColumnMappingJson("{"), null);
});

test("CSV import mapping rejects missing title and unexpected keys", () => {
  assert.equal(
    parseCsvColumnMappingJson(JSON.stringify({ status: "State" })),
    null,
  );
  assert.equal(
    parseCsvColumnMappingJson(
      JSON.stringify({ title: "Name", provider: "STEAM" }),
    ),
    null,
  );
  assert.equal(
    parseCsvColumnMappingJson('{"title":"Name","extra":"unexpected"}'),
    null,
  );
});

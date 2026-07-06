# Plan 010: Validate CSV Column Mapping JSON

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 80086a6..HEAD -- src/app/profile/actions.ts src/lib/catalog.ts src/components/csv-import-widget.tsx tests`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `80086a6`, 2026-07-03
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/102

## Why this matters

The CSV import server action validates that a `mapping` string exists, then
calls `JSON.parse` and casts the result to `CsvColumnMapping`. Invalid JSON can
throw before the import error handling path, and arbitrary object shapes can
reach catalog import logic. A small schema keeps malformed form posts on the
same clear user-facing error path as other invalid CSV submissions.

## Current state

Current action schema only checks for a string:

```ts
// src/app/profile/actions.ts:39-43
const importSchema = z.object({
  fileName: z.string().min(1),
  csvText: z.string().min(1),
  mapping: z.string().min(1),
});
```

Current parse/cast:

```ts
// src/app/profile/actions.ts:1025-1028
const mapping = JSON.parse(parsed.data.mapping) as CsvColumnMapping;
if (!mapping.title) {
  redirect(`/profile?error=${encodeURIComponent(t("profileAction.needTitleMapping"))}`);
}
```

Current mapping type:

```ts
// src/lib/catalog.ts:34-43
export type CsvColumnMapping = {
  title: string;
  platform?: string;
  status?: string;
  playtimeHours?: string;
  completionPercent?: string;
  notes?: string;
  externalId?: string;
  provider?: "PLAYSTATION" | "XBOX";
};
```

Repo conventions to match:

- Server actions use `zod` for form validation.
- CSV import should preserve `ImportJob`/`ImportRow` audit behavior.
- Provider-specific import shortcuts must still go through canonical catalog
  resolution.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint | `npm run lint` | exit 0; existing `next/image` warnings may remain |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0 |

## Scope

**In scope**:

- `src/app/profile/actions.ts`
- `src/lib/catalog.ts` or a new small helper module under `src/lib/`
- `tests/csv-import-mapping.test.mjs` or a nearby existing test file
- `src/components/csv-import-widget.tsx` only if type exports need updating

**Out of scope**:

- Changing CSV UI layout
- Changing import row audit semantics
- Changing status parsing behavior in `src/lib/catalog.ts`
- Adding new providers

## Git workflow

- Branch: `codex/010-validate-csv-mapping`
- Commit message style: imperative, matching recent history such as
  `Generate Next route types before typecheck`
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a reusable mapping parser/schema

Create a zod schema for CSV column mappings. Prefer a small helper module such
as `src/lib/csv-import-mapping.ts` to avoid importing all of `catalog.ts` from
tests. It should export:

- `CsvColumnMappingSchema`
- `parseCsvColumnMappingJson(raw: string): CsvColumnMapping | null` or a
  `safeParse` style helper
- `CsvColumnMapping` type, if moving it out of `catalog.ts` avoids duplication

Schema requirements:

- `title`: required non-empty string after trim.
- optional string fields: `platform`, `status`, `playtimeHours`,
  `completionPercent`, `notes`, `externalId`; trim and treat empty strings as
  `undefined` if practical.
- optional `provider`: enum of `"PLAYSTATION"` or `"XBOX"`.
- reject arrays, `null`, and non-object JSON.

**Verify**: `npm run typecheck` -> exit 0.

### Step 2: Use the parser in `importCsvAction`

Replace direct `JSON.parse(...) as CsvColumnMapping` with the safe parser.

Behavior:

- malformed JSON redirects with `profileAction.invalidCsv`;
- valid JSON missing `title` redirects with `profileAction.needTitleMapping`
  if you keep that separate, or with `invalidCsv` if the schema owns the
  required-title check;
- valid mappings continue to call `importCsvForUser` unchanged.

Do not catch and expose raw `JSON.parse` errors.

**Verify**:
`rg -n "JSON\\.parse\\(parsed\\.data\\.mapping\\)|as CsvColumnMapping" src/app/profile/actions.ts`
-> no matches.

### Step 3: Add parser tests

Add tests for:

- valid generic mapping;
- valid PlayStation/Xbox provider mapping;
- malformed JSON returns invalid;
- array/object without title returns invalid;
- unsupported provider returns invalid.

Use `node:test` and `node:assert/strict`.

**Verify**: `npm test` -> exit 0.

### Step 4: Run full verification

**Verify**:

- `npm run lint` -> exit 0; existing `next/image` warnings may remain.
- `npm run typecheck` -> exit 0.
- `npm test` -> exit 0.

## Test plan

- New parser tests should be pure and not touch Prisma.
- Existing catalog/import tests should keep passing.

## Done criteria

- [ ] CSV mapping JSON is parsed through zod or an equivalent safe parser.
- [ ] Direct unguarded `JSON.parse(parsed.data.mapping)` is gone.
- [ ] Invalid mapping payloads produce a controlled redirect, not an uncaught
  server action exception.
- [ ] New parser tests cover valid and invalid cases.
- [ ] `npm run lint`, `npm run typecheck`, and `npm test` exit 0.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The CSV widget sends a mapping shape that conflicts with the current
  `CsvColumnMapping` type.
- Preserving current behavior requires changing import audit semantics.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Future import fields should be added to the schema and tests at the same time
as the UI mapping. Reviewers should reject new direct casts from request JSON
to catalog types.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("beta submissions use a persistent tagged cache invalidated by the admin action", () => {
  const submissionsSource = readFileSync(
    new URL("../src/lib/beta-submissions.ts", import.meta.url),
    "utf8",
  );
  const adminActionsSource = readFileSync(
    new URL("../src/app/admin/actions.ts", import.meta.url),
    "utf8",
  );

  assert.match(submissionsSource, /unstable_cache/);
  assert.match(
    submissionsSource,
    /tags:\s*\[BETA_SUBMISSIONS_CACHE_TAG\]/,
  );
  assert.doesNotMatch(
    submissionsSource,
    /revalidate:\s*\d/,
    "the beta setting should remain cached until the admin mutation invalidates it",
  );

  const mutationIndex = adminActionsSource.indexOf(
    "await setBetaSubmissionsOpen",
  );
  const invalidationIndex = adminActionsSource.indexOf(
    "updateTag(BETA_SUBMISSIONS_CACHE_TAG)",
  );

  assert.notEqual(mutationIndex, -1);
  assert.ok(
    invalidationIndex > mutationIndex,
    "the cache tag must be invalidated after the database mutation succeeds",
  );
});

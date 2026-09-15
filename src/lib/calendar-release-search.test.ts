import assert from "node:assert/strict";
import { test } from "node:test";
import { parseReleaseSearch } from "./calendar-release-search.ts";

const now = new Date("2026-09-15T12:00:00Z");
const release = { title: "Example", platform: "PC", region: "Worldwide", kind: "release_date", precision: "day", date: "2026-10-03", dateLabel: "2026-10-03", sourceUrl: "https://store.steampowered.com/app/123/example", sourceType: "store", evidence: "Example releases on PC on October 3, 2026." };
function payload(releases: unknown[], cited = true) {
  return { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ releases }), annotations: cited ? [{ type: "url_citation", url: release.sourceUrl }] : [] }] }] };
}
test("accepts a cited day-specific release and rejects ungrounded URLs", () => {
  const items = parseReleaseSearch(payload([release]), now);
  assert.equal(items[0].releaseDate?.toISOString().slice(0, 10), "2026-10-03");
  assert.deepEqual(parseReleaseSearch(payload([release], false), now), []);
  assert.deepEqual(parseReleaseSearch(payload([{ ...release, sourceUrl: "https://invented.example/game" }]), now), []);
});
test("excludes other news, rumors, past dates, invalid dates and non-primary sources", () => {
  for (const change of [{ kind: "trailer" }, { precision: "rumor" }, { date: "2026-02-30" }, { date: "2026-01-01" }, { sourceType: "news" }]) {
    assert.deepEqual(parseReleaseSearch(payload([{ ...release, ...change }]), now), []);
  }
});
test("partial dates and TBA remain undated; platform dates stay separate", () => {
  const items = parseReleaseSearch(payload([release, { ...release, platform: "PS5", date: null, precision: "unknown", dateLabel: "TBA" }]), now);
  assert.equal(items.length, 2);
  assert.equal(items[1].releaseDate, null);
  assert.deepEqual(parseReleaseSearch(payload([{ ...release, precision: "month" }]), now), []);
});
test("handles OpenRouter citations and rejects truncated responses", () => {
  const result = { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ releases: [release] }), annotations: [{ type: "url_citation", url_citation: { url: release.sourceUrl } }] } }] };
  assert.equal(parseReleaseSearch(result, now).length, 1);
  result.choices[0].finish_reason = "length";
  assert.throws(() => parseReleaseSearch(result, now));
});

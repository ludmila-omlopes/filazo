import assert from "node:assert/strict";
import { test } from "node:test";
import { hasReleaseEvidence, isPrimaryReleaseUrl } from "./calendar-release-evidence.ts";
const release = { title: "Example", platform: "PC", releaseDate: new Date("2026-10-03"), evidence: "Example releases on PC on October 3, 2026." };
test("only recognized primary hosts qualify, not model-labeled news sites or lookalikes", () => {
  assert.equal(isPrimaryReleaseUrl("https://press.na.square-enix.com/game"), true);
  for (const url of ["https://www.gematsu.com/news", "https://nintendo.com.example.org/", "http://127.0.0.1", "https://nintendo.com@evil.example"]) assert.equal(isPrimaryReleaseUrl(url), false);
});
test("requires the title, correct platform and date in an actual release excerpt", () => {
  assert.equal(hasReleaseEvidence(`Navigation ${release.evidence} Footer`, release), true);
  assert.equal(hasReleaseEvidence("Another game releases on October 3, 2026", release), false);
  assert.equal(hasReleaseEvidence(release.evidence, { ...release, platform: "PS5" }), false);
  assert.equal(hasReleaseEvidence(release.evidence, { ...release, releaseDate: new Date("2026-03-10") }), false);
  assert.equal(hasReleaseEvidence("Example releases on PC on 10/3/2026", { ...release, evidence: "Example releases on PC on 10/3/2026" }), false);
});
test("normalizes trademark markup used by official release pages", () => {
  const branded = {
    title: "Example",
    platform: "PS5",
    releaseDate: new Date("2026-10-03"),
    evidence: "Example launches on PlayStation®5 on October 3, 2026.",
  };
  assert.equal(hasReleaseEvidence("Example launches on PlayStation 5 on October 3, 2026.", branded), true);
});

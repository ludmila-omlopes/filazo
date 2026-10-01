import assert from "node:assert/strict";
import test from "node:test";
import { isDiscoveryGameType, profileMechanics, readDiscoverySnapshot, scoreGameAffinity, type AffinityProfile } from "./game-affinity.ts";

const named = (id: number, name: string) => ({ id, name });
const profile = (igdbId: number, overrides: Partial<AffinityProfile> = {}): AffinityProfile => ({
  igdbId, keywords: [], genres: [named(1, "Role-playing (RPG)")],
  themes: [named(2, "Fantasy")], perspectives: [named(3, "Third person")],
  modes: [named(4, "Single player")], developers: [], collections: [], similarIds: [], ...overrides,
});
const elden = profile(119133, { keywords: [named(5, "soulslike"), named(6, "parrying")] });

test("Elden Ring qualifies another soulslike and rejects a generic RPG even when linked as similar", () => {
  const souls = profile(11133, { keywords: [named(5, "Souls-like")] });
  assert.equal(scoreGameAffinity(elden, souls)?.reason.kind, "mechanic");
  assert.equal(scoreGameAffinity({ ...elden, similarIds: [8] }, profile(8)), null);
});
test("broad genres, setting, studio and popularity are insufficient", () => {
  assert.equal(scoreGameAffinity(profile(1, { developers: [named(8, "Studio")] }), profile(2, { developers: [named(8, "Studio")] })), null);
});
test("no source title can recommend itself", () => { assert.equal(scoreGameAffinity(elden, elden), null); });
test("soulslike tag on a turn-based game does not imply matching real-time combat", () => {
  assert.equal(scoreGameAffinity(elden, profile(2, { keywords: [named(5, "soulslike"), named(7, "turn-based combat")] })), null);
});
test("perspective and related-game signals refine gameplay affinity", () => {
  const shared = profile(2, { keywords: elden.keywords });
  assert.ok(scoreGameAffinity(elden, shared)!.score > scoreGameAffinity(elden, { ...shared, perspectives: [named(9, "Bird view / Isometric")] })!.score);
  assert.ok(scoreGameAffinity({ ...elden, similarIds: [2] }, shared)!.score > scoreGameAffinity(elden, shared)!.score);
});
test("unknown gameplay family needs direct affinity or several specific features", () => {
  const keywords = [named(30, "parkour"), named(31, "grappling hook"), named(32, "wall running")];
  assert.equal(scoreGameAffinity(profile(1, { similarIds: [2], keywords }), profile(2, { keywords }))?.reason.kind, "similar");
  assert.equal(scoreGameAffinity(profile(1), profile(2)), null);
});
test("farming, metroidvania and deckbuilding qualify their own families", () => {
  for (const keyword of ["farming simulation", "metroidvania", "deck-building"]) {
    const a = profile(1, { keywords: [named(20, keyword)] });
    assert.equal(profileMechanics(a).length, 1);
    assert.ok(scoreGameAffinity(a, { ...a, igdbId: 2 }));
    assert.equal(scoreGameAffinity(a, elden), null);
  }
});
test("pure expansion/DLC/bundle excluded; complete remake/remaster remains eligible", () => {
  for (const type of ["Expansion", "DLC", "Bundle", "Mod", "Update"]) assert.equal(isDiscoveryGameType(type), false);
  for (const type of ["Main Game", "Remake", "Remaster", "Expanded Game", "Standalone Expansion"]) assert.equal(isDiscoveryGameType(type), true);
});
test("malformed cache never becomes displayed recommendations", () => {
  assert.equal(readDiscoverySnapshot({ gameDiscovery: { version: 1, recommendations: [{ gameId: "x" }] } }), null);
  assert.equal(readDiscoverySnapshot(null), null);
});

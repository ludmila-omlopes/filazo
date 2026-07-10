import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalizeGameTitle,
  cleanGameTitle,
  normalizeTitle,
  slugify,
  uniqueSlug,
} from "./utils.ts";

test("cleanGameTitle removes trademark symbols and trims spacing", () => {
  assert.equal(cleanGameTitle("  The Witcher® 3™  "), "The Witcher 3");
});

test("normalizeTitle strips punctuation and lowercases titles", () => {
  assert.equal(
    normalizeTitle("The Witcher® 3: Wild Hunt"),
    "the witcher 3 wild hunt",
  );
});

test("normalizeTitle folds decomposed accented Latin letters", () => {
  assert.equal(normalizeTitle("Pokémon"), "pokemon");
});

test("normalizeTitle is idempotent", () => {
  const inputs = [
    "The Witcher® 3: Wild Hunt",
    "  DOOM Eternal  ",
    "Pokémon Legends: Arceus",
  ];

  for (const input of inputs) {
    assert.equal(normalizeTitle(normalizeTitle(input)), normalizeTitle(input));
  }
});

test("slugify converts normalized whitespace to dashes", () => {
  assert.equal(slugify("The Witcher 3: Wild Hunt"), "the-witcher-3-wild-hunt");
});

test("normalization helpers preserve empty output for empty or symbol-only input", () => {
  assert.equal(slugify(""), "");
  assert.equal(normalizeTitle("™®©"), "");
});

test("uniqueSlug appends a lowercased suffix", () => {
  assert.equal(uniqueSlug("Doom", "ABC1"), "doom-abc1");
});

test("normalizeTitle currently strips non-Latin titles that do not decompose", () => {
  assert.equal(normalizeTitle("ゼルダの伝説"), "");
});

test("canonicalizeGameTitle consolidates base Minecraft editions", () => {
  const variants = [
    "Minecraft Launcher",
    "Minecraft for Windows",
    "Minecraft: Java Edition",
    "Minecraft: Bedrock Edition",
    "Minecraft: Java & Bedrock Edition for PC",
    "Minecraft for PlayStation®",
    "Minecraft: PlayStation®5 Edition",
  ];

  for (const variant of variants) {
    assert.equal(canonicalizeGameTitle(variant), "Minecraft");
  }
});

test("canonicalizeGameTitle keeps Minecraft spin-offs separate", () => {
  assert.equal(canonicalizeGameTitle("Minecraft Dungeons"), "Minecraft Dungeons");
  assert.equal(canonicalizeGameTitle("Minecraft Legends"), "Minecraft Legends");
  assert.equal(canonicalizeGameTitle("Minecraft: Story Mode"), "Minecraft: Story Mode");
});

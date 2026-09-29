import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatCatalogPlatformName,
  formatPlatformNames,
  normalizePlatformNames,
} from "./platform-names.ts";

test("normalization is idempotent and collapses aliases within a bundle", () => {
  const input = "PlayStation, PlayStation PS4, ps4, PS5/PS4; Win32, PlayStation PC";
  assert.deepEqual(normalizePlatformNames(input), ["PS4", "PS5", "PC"]);
  assert.equal(formatPlatformNames(formatPlatformNames(input)), "PS4, PS5, PC");
});

test("console generations and combined Series X/S labels stay distinct", () => {
  assert.deepEqual(normalizePlatformNames("Xbox, XboxOne, Xbox360, Xbox Series X/S, Xbox Series X|S"), ["Xbox One", "Xbox 360", "Xbox Series X/S"]);
});

test("catalog platform names get short display labels without touching unknown names", () => {
  assert.equal(formatCatalogPlatformName("PC (Microsoft Windows)"), "PC");
  assert.equal(formatCatalogPlatformName("PlayStation 3"), "PS3");
  assert.equal(formatCatalogPlatformName("  nintendo   switch "), "Switch");
  assert.equal(formatCatalogPlatformName("Mac"), "macOS");
  assert.equal(formatCatalogPlatformName("Xbox 360"), "Xbox 360");
  assert.equal(formatCatalogPlatformName("Amiga"), "Amiga");
});

test("unknown platforms are retained and deduplicated without guessing hardware", () => {
  assert.deepEqual(normalizePlatformNames("My Console, my console"), ["My Console"]);
  assert.deepEqual(normalizePlatformNames("PlayStation PC, PlayStation"), ["PC", "PlayStation"]);
  assert.deepEqual(normalizePlatformNames(null), []);
});

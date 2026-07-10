import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalizePlayStationGameTitle,
  getPlayStationArtworkFallback,
} from "./playstation-catalog.ts";

test("canonicalizes the localized The Last of Us Part I title", () => {
  assert.equal(
    canonicalizePlayStationGameTitle("The Last of Us™ Parte I"),
    "The Last of Us Part I",
  );
});

test("preserves unrelated PlayStation titles", () => {
  assert.equal(
    canonicalizePlayStationGameTitle("The Last of Us™ Part II"),
    "The Last of Us Part II",
  );
});

test("extracts preferred PlayStation cover and hero artwork", () => {
  assert.deepEqual(
    getPlayStationArtworkFallback({
      playStationSyncSources: [
        {
          imageUrl: "https://example.com/master.png",
          media: {
            images: [
              { type: "BACKGROUND_LAYER_ART", url: "https://example.com/hero.png" },
              { type: "GAMEHUB_COVER_ART", url: "https://example.com/cover.png" },
            ],
          },
        },
      ],
    }),
    {
      coverUrl: "https://example.com/cover.png",
      heroUrl: "https://example.com/hero.png",
    },
  );
});

test("falls back to the PlayStation source image", () => {
  assert.deepEqual(
    getPlayStationArtworkFallback({
      playStationSyncSources: [
        { imageUrl: "https://example.com/icon.png" },
      ],
    }),
    {
      coverUrl: "https://example.com/icon.png",
      heroUrl: "https://example.com/icon.png",
    },
  );
});

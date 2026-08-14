import assert from "node:assert/strict";
import test from "node:test";
import {
  getImportSourceImages,
  isPhotoImport,
} from "./import-audit.ts";

test("identifies photo import jobs", () => {
  assert.equal(isPhotoImport({ source: "photo-import" }), true);
  assert.equal(isPhotoImport({ source: "csv" }), false);
  assert.equal(isPhotoImport(null), false);
});

test("reads and deduplicates source images stored in the job summary", () => {
  assert.deepEqual(
    getImportSourceImages({
      summary: {
        sourceImages: [
          {
            fileName: "shelf.png",
            url: "/uploads/imports/first.png",
          },
          {
            fileName: "shelf-again.png",
            url: "/uploads/imports/first.png",
          },
        ],
      },
      rows: [],
    }),
    [
      {
        fileName: "shelf.png",
        url: "/uploads/imports/first.png",
      },
    ],
  );
});

test("falls back to legacy row data and ignores unrelated image URLs", () => {
  assert.deepEqual(
    getImportSourceImages({
      summary: null,
      rows: [
        {
          rawData: {
            fileName: "catalog.webp",
            sourceImageUrl: "/uploads/imports/legacy.webp",
          },
        },
        {
          rawData: {
            sourceImageUrl: "https://example.com/not-an-import.png",
          },
        },
      ],
    }),
    [
      {
        fileName: "catalog.webp",
        url: "/uploads/imports/legacy.webp",
      },
    ],
  );
});

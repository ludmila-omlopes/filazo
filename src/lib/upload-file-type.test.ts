import assert from "node:assert/strict";
import { test } from "node:test";
import { getAllowedUploadExtension } from "./upload-file-type.ts";

test("allows PNG image uploads", () => {
  assert.equal(getAllowedUploadExtension("image/png", "image"), ".png");
});

test("rejects SVG image uploads", () => {
  assert.equal(getAllowedUploadExtension("image/svg+xml", "image"), null);
});

test("rejects HTML as an image upload", () => {
  assert.equal(getAllowedUploadExtension("text/html", "image"), null);
});

test("rejects image MIME types for audio uploads", () => {
  assert.equal(getAllowedUploadExtension("image/png", "audio"), null);
});

test("allows MP3 audio uploads", () => {
  assert.equal(getAllowedUploadExtension("audio/mpeg", "audio"), ".mp3");
});

test("normalizes parameterized and uppercase MIME types", () => {
  assert.equal(
    getAllowedUploadExtension("image/jpeg; charset=utf-8", "image"),
    ".jpg",
  );
  assert.equal(getAllowedUploadExtension("IMAGE/PNG", "image"), ".png");
});

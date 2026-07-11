import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildUploadPath,
  getAllowedUploadExtension,
  getAllowedUploadMimeType,
} from "./upload-file-type.ts";

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

test("builds a safe journal path from an allowed normalized MIME type", () => {
  assert.deepEqual(
    buildUploadPath({
      fileId: "a1b2c3d4",
      kind: "audio",
      mimeType: "audio/webm;codecs=opus",
      prefix: "journal/user/",
    }),
    {
      mimeType: "audio/webm",
      pathname: "journal/user/a1b2c3d4.webm",
    },
  );
  assert.equal(
    getAllowedUploadMimeType("image/svg+xml", "image"),
    null,
  );
});

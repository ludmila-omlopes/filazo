import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import {
  getUploadContentType,
  getUploadDirectory,
  getUploadDiskPath,
  getUploadStorageKeyFromRoutePath,
} from "../src/lib/upload-storage.ts";

const previousUploadDir = process.env.FILAZO_UPLOAD_DIR;
const previousVercel = process.env.VERCEL;

afterEach(() => {
  if (previousUploadDir === undefined) {
    delete process.env.FILAZO_UPLOAD_DIR;
  } else {
    process.env.FILAZO_UPLOAD_DIR = previousUploadDir;
  }

  if (previousVercel === undefined) {
    delete process.env.VERCEL;
  } else {
    process.env.VERCEL = previousVercel;
  }
});

test("resolves upload storage keys inside the configured upload directory", () => {
  const root = path.join(os.tmpdir(), "filazo-upload-test");

  assert.equal(
    getUploadDiskPath("uploads/journal/voice.webm", root),
    path.join(root, "journal", "voice.webm"),
  );
});

test("rejects unsafe upload storage keys", () => {
  const root = path.join(os.tmpdir(), "filazo-upload-test");

  assert.equal(getUploadDiskPath("uploads/journal/../secret.webm", root), null);
  assert.equal(getUploadDiskPath("uploads/journal/..\\secret.webm", root), null);
  assert.equal(getUploadDiskPath("other/journal/voice.webm", root), null);
});

test("builds storage keys from safe route path segments", () => {
  assert.equal(
    getUploadStorageKeyFromRoutePath(["journal", "voice.webm"]),
    "uploads/journal/voice.webm",
  );
  assert.equal(getUploadStorageKeyFromRoutePath(["..", "voice.webm"]), null);
});

test("uses a writable temp upload directory in Vercel-style deployments", () => {
  delete process.env.FILAZO_UPLOAD_DIR;
  process.env.VERCEL = "1";

  assert.equal(
    getUploadDirectory(),
    path.join(os.tmpdir(), "filazo-uploads"),
  );
});

test("detects known upload content types", () => {
  assert.equal(getUploadContentType("uploads/journal/voice.webm"), "audio/webm");
  assert.equal(getUploadContentType("uploads/journal/screenshot.png"), "image/png");
  assert.equal(getUploadContentType("uploads/journal/file.bin"), null);
});

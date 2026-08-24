import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  classifyRecordingStartFailure,
  getRecordingFileExtension,
  selectRecorderMimeType,
} from "../src/lib/voice-recording.ts";
import {
  buildUploadPath,
  getAllowedUploadMimeType,
} from "../src/lib/upload-file-type.ts";

test("voice recording selects formats supported by Chromium and Safari", () => {
  assert.equal(
    selectRecorderMimeType((type) => type === "audio/webm;codecs=opus"),
    "audio/webm;codecs=opus",
  );
  assert.equal(
    selectRecorderMimeType((type) => type === "audio/mp4"),
    "audio/mp4",
  );
  assert.equal(selectRecorderMimeType(() => false), "");

  assert.equal(getRecordingFileExtension("audio/mp4;codecs=mp4a.40.2"), "m4a");
  assert.equal(getRecordingFileExtension("audio/ogg;codecs=opus"), "ogg");
  assert.equal(getRecordingFileExtension("audio/webm;codecs=opus"), "webm");
});

test("voice recording reports actionable browser failures", () => {
  assert.equal(
    classifyRecordingStartFailure({ name: "NotAllowedError" }),
    "permission-denied",
  );
  assert.equal(
    classifyRecordingStartFailure({ name: "NotFoundError" }),
    "microphone-unavailable",
  );
  assert.equal(
    classifyRecordingStartFailure({ name: "NotReadableError" }),
    "microphone-busy",
  );
  assert.equal(
    classifyRecordingStartFailure({ name: "SecurityError" }),
    "secure-context-required",
  );
});

test("journal uploads accept the common Safari M4A MIME alias", () => {
  assert.equal(getAllowedUploadMimeType("audio/x-m4a", "audio"), "audio/x-m4a");
  assert.deepEqual(
    buildUploadPath({
      fileId: "ios-recording",
      kind: "audio",
      mimeType: "audio/x-m4a",
      prefix: "journal/test/",
    }),
    {
      mimeType: "audio/x-m4a",
      pathname: "journal/test/ios-recording.m4a",
    },
  );
});

test("journal keeps gallery and camera paths separate on mobile", () => {
  const composerSource = readFileSync(
    new URL(
      "../src/app/profile/_components/journal-composer.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const formSource = readFileSync(
    new URL(
      "../src/app/profile/_components/journal-form.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(composerSource, /capture="environment"/);
  assert.match(composerSource, /journal\.imageFromDevice/);
  assert.match(composerSource, /journal\.takePhoto/);
  assert.equal(composerSource.match(/name="image"/g)?.length, 2);
  assert.match(formSource, /\.getAll\(name\)/);
});

test("voice memory always exposes a playable upload fallback", () => {
  const voiceSource = readFileSync(
    new URL("../src/components/voice-memory-input.tsx", import.meta.url),
    "utf8",
  );

  assert.match(voiceSource, /voiceMemory\.uploadInstead/);
  assert.match(voiceSource, /audio\/x-m4a/);
  assert.match(voiceSource, /onChange=\{handleAudioSelection\}/);
  assert.match(voiceSource, /preload="metadata"/);
  assert.match(voiceSource, /blob\.size === 0/);
  assert.match(voiceSource, /classifyRecordingStartFailure/);
});

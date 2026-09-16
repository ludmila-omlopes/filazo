export const JOURNAL_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const JOURNAL_UPLOAD_REQUEST_MAX_BYTES = 8 * 1024;

export function journalUploadMaxBytes(kind: "image" | "audio", maxAudioBytes: number) {
  return kind === "image" ? JOURNAL_IMAGE_MAX_BYTES : maxAudioBytes;
}

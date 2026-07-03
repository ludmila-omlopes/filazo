export type UploadKind = "image" | "audio";

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/ogg": ".ogg",
};

export function getAllowedUploadExtension(
  mimeType: string,
  kind: UploadKind,
): string | null {
  const table = kind === "image" ? IMAGE_EXTENSIONS : AUDIO_EXTENSIONS;
  return table[mimeType.toLowerCase().split(";")[0].trim()] ?? null;
}

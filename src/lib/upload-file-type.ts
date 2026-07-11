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

function normalizeMimeType(mimeType: string) {
  return mimeType.toLowerCase().split(";", 1)[0]?.trim() ?? "";
}

export function getAllowedUploadMimeType(
  mimeType: string,
  kind: UploadKind,
): string | null {
  const table = kind === "image" ? IMAGE_EXTENSIONS : AUDIO_EXTENSIONS;
  const normalizedMimeType = normalizeMimeType(mimeType);
  return table[normalizedMimeType] ? normalizedMimeType : null;
}

export function getAllowedUploadMimeTypes(kind: UploadKind) {
  const table = kind === "image" ? IMAGE_EXTENSIONS : AUDIO_EXTENSIONS;
  return Object.keys(table);
}

export function getAllowedUploadExtensions(kind: UploadKind) {
  const table = kind === "image" ? IMAGE_EXTENSIONS : AUDIO_EXTENSIONS;
  return new Set(Object.values(table));
}

export function buildUploadPath({
  fileId,
  kind,
  mimeType,
  prefix,
}: {
  fileId: string;
  kind: UploadKind;
  mimeType: string;
  prefix: string;
}) {
  const normalizedMimeType = getAllowedUploadMimeType(mimeType, kind);
  const extension = normalizedMimeType
    ? getAllowedUploadExtension(normalizedMimeType, kind)
    : null;

  if (!extension) {
    throw new Error(
      kind === "image"
        ? "Screenshot uploads must be PNG, JPEG, WebP, or GIF files."
        : "Voice uploads must be WebM, MP3, M4A, WAV, or OGG files.",
    );
  }

  return {
    mimeType: normalizedMimeType as string,
    pathname: `${prefix}${fileId}${extension}`,
  };
}

export function getAllowedUploadExtension(
  mimeType: string,
  kind: UploadKind,
): string | null {
  const table = kind === "image" ? IMAGE_EXTENSIONS : AUDIO_EXTENSIONS;
  return table[normalizeMimeType(mimeType)] ?? null;
}

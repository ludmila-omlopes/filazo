export const RECORDER_MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

export type RecordingStartFailure =
  | "permission-denied"
  | "microphone-unavailable"
  | "microphone-busy"
  | "secure-context-required"
  | "unknown";

export function selectRecorderMimeType(
  isTypeSupported: (mimeType: string) => boolean,
) {
  return (
    RECORDER_MIME_TYPE_CANDIDATES.find((mimeType) =>
      isTypeSupported(mimeType),
    ) ?? ""
  );
}

export function getRecordingFileExtension(mimeType: string) {
  const normalized = mimeType.toLowerCase().split(";", 1)[0]?.trim() ?? "";

  if (normalized === "audio/mp4" || normalized === "audio/x-m4a") {
    return "m4a";
  }

  if (normalized === "audio/ogg") {
    return "ogg";
  }

  if (normalized === "audio/mpeg") {
    return "mp3";
  }

  if (normalized === "audio/wav" || normalized === "audio/x-wav") {
    return "wav";
  }

  return "webm";
}

export function classifyRecordingStartFailure(
  error: unknown,
): RecordingStartFailure {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String(error.name)
      : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "permission-denied";
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "microphone-unavailable";
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return "microphone-busy";
  }

  if (name === "SecurityError") {
    return "secure-context-required";
  }

  return "unknown";
}

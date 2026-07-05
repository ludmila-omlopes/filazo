import os from "node:os";
import path from "node:path";

const UPLOAD_ROUTE_PREFIX = "uploads";
const DEFAULT_SERVERLESS_UPLOAD_DIR = "filazo-uploads";
const ALLOWED_UPLOAD_FOLDERS = new Set(["journal", "imports"]);

const CONTENT_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".wav": "audio/wav",
  ".webm": "audio/webm",
  ".webp": "image/webp",
};

function hasServerlessReadOnlyBundle() {
  return Boolean(process.env.VERCEL) || process.cwd().startsWith("/var/task");
}

function isSafeUploadSegment(segment: string) {
  return (
    Boolean(segment) &&
    segment !== "." &&
    segment !== ".." &&
    !segment.includes("/") &&
    !segment.includes("\\") &&
    !segment.includes("\0")
  );
}

export function getUploadDirectory() {
  const configuredDirectory = process.env.FILAZO_UPLOAD_DIR?.trim();
  if (configuredDirectory) {
    return path.resolve(configuredDirectory);
  }

  if (hasServerlessReadOnlyBundle()) {
    return path.join(os.tmpdir(), DEFAULT_SERVERLESS_UPLOAD_DIR);
  }

  return path.join(process.cwd(), "public", UPLOAD_ROUTE_PREFIX);
}

export function getUploadStorageKeyFromRoutePath(segments: string[]) {
  if (!segments.length || !segments.every(isSafeUploadSegment)) {
    return null;
  }

  return `${UPLOAD_ROUTE_PREFIX}/${segments.join("/")}`;
}

export function getUploadDiskPath(
  storageKey: string,
  uploadDirectory = getUploadDirectory(),
) {
  const segments = storageKey.split("/").filter(Boolean);
  if (
    segments.length < 3 ||
    segments[0] !== UPLOAD_ROUTE_PREFIX ||
    !ALLOWED_UPLOAD_FOLDERS.has(segments[1]) ||
    !segments.every(isSafeUploadSegment)
  ) {
    return null;
  }

  const root = path.resolve(uploadDirectory);
  const target = path.resolve(root, ...segments.slice(1));
  const rootWithSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (target !== root && !target.startsWith(rootWithSeparator)) {
    return null;
  }

  return target;
}

export function getUploadContentType(storageKey: string) {
  return CONTENT_TYPES[path.extname(storageKey).toLowerCase()] ?? null;
}

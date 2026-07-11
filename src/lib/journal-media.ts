import { del, get, head } from "@vercel/blob";
import { z } from "zod";
import {
  getAllowedUploadExtensions,
  getAllowedUploadExtension,
  getAllowedUploadMimeType,
  type UploadKind,
} from "@/lib/upload-file-type";

const BLOB_PATH_PREFIX = "journal/";
const STORAGE_KEY_PREFIX = "uploads/";

export const journalUploadPayloadSchema = z.object({
  kind: z.enum(["image", "audio"]),
  pathname: z.string().trim().min(1).max(320),
  fileName: z.string().trim().max(255).optional(),
});

export type JournalUploadPayload = z.infer<typeof journalUploadPayloadSchema>;

export type StoredJournalMedia = {
  fileName: string;
  kind: UploadKind;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  storageProvider: "vercel-blob";
  url: string;
};

function getBlobPath(storageKey: string) {
  if (!storageKey.startsWith(STORAGE_KEY_PREFIX)) {
    return null;
  }

  const pathname = storageKey.slice(STORAGE_KEY_PREFIX.length);
  return pathname.startsWith(BLOB_PATH_PREFIX) ? pathname : null;
}

function getSafeFileName(fileName: string | undefined, fallback: string) {
  const normalized = (fileName ?? fallback)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return normalized || fallback;
}

function isExpectedJournalPath(pathname: string, userId: string, kind: UploadKind) {
  const prefix = `${BLOB_PATH_PREFIX}${userId}/`;
  if (!pathname.startsWith(prefix)) {
    return false;
  }

  const fileName = pathname.slice(prefix.length);
  if (!/^[a-f0-9-]{36}\.[a-z0-9]+$/i.test(fileName)) {
    return false;
  }

  const extension = `.${fileName.split(".").pop()?.toLowerCase() ?? ""}`;
  return getAllowedUploadExtensions(kind).has(extension);
}

export function canUploadJournalPath(
  pathname: string,
  userId: string,
  kind: UploadKind,
) {
  return isExpectedJournalPath(pathname, userId, kind);
}

export async function resolveJournalUpload({
  maxAudioBytes,
  payload,
  userId,
}: {
  maxAudioBytes: number;
  payload: JournalUploadPayload;
  userId: string;
}): Promise<StoredJournalMedia> {
  if (!isExpectedJournalPath(payload.pathname, userId, payload.kind)) {
    throw new Error("Uploaded media is not available for this journal entry.");
  }

  const blob = await head(payload.pathname);
  const mimeType = getAllowedUploadMimeType(blob.contentType, payload.kind);
  const extension = mimeType
    ? getAllowedUploadExtension(mimeType, payload.kind)
    : null;
  if (!mimeType || !extension || !payload.pathname.endsWith(extension)) {
    throw new Error("Uploaded media type is not allowed.");
  }
  if (payload.kind === "audio" && blob.size > maxAudioBytes) {
    throw new Error("Voice upload exceeds the configured file-size limit.");
  }

  const storageKey = `${STORAGE_KEY_PREFIX}${payload.pathname}`;
  return {
    kind: payload.kind,
    url: `/${storageKey}`,
    storageKey,
    storageProvider: "vercel-blob",
    mimeType,
    fileName: getSafeFileName(payload.fileName, `journal-media${extension}`),
    sizeBytes: blob.size,
  };
}

export async function getJournalAudioFile(media: StoredJournalMedia) {
  const blobPath = getBlobPath(media.storageKey);
  if (!blobPath) {
    throw new Error("Journal audio storage path is not available.");
  }

  const result = await get(blobPath, { access: "private", useCache: false });
  if (!result?.stream) {
    throw new Error("Journal audio file is no longer available.");
  }

  const contents = await new Response(result.stream).blob();
  return new File([contents], media.fileName, { type: media.mimeType });
}

export async function deleteJournalMediaObject({
  storageKey,
  storageProvider,
}: {
  storageKey: string;
  storageProvider: string;
}) {
  if (storageProvider !== "vercel-blob") {
    return false;
  }

  const blobPath = getBlobPath(storageKey);
  if (!blobPath) {
    return false;
  }

  await del(blobPath);
  return true;
}

export async function getPrivateJournalMedia(storageKey: string) {
  const blobPath = getBlobPath(storageKey);
  if (!blobPath) {
    return null;
  }

  return get(blobPath, { access: "private" });
}

import { readFile } from "node:fs/promises";
import {
  getPrivateJournalMedia,
} from "@/lib/journal-media";
import {
  getUploadContentType,
  getUploadDiskPath,
  getUploadStorageKeyFromRoutePath,
} from "@/lib/upload-storage";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const storageKey = getUploadStorageKeyFromRoutePath(path);
  if (!storageKey) {
    return new Response("Not found", { status: 404 });
  }

  if (path[0] === "journal") {
    const userId = await getSessionUserId();
    if (!userId) {
      return new Response("Not found", { status: 404 });
    }

    const media = await prisma.journalMedia.findFirst({
      where: {
        storageKey,
        journalEntry: { userId },
      },
      select: {
        storageProvider: true,
      },
    });
    if (!media) {
      return new Response("Not found", { status: 404 });
    }

    const headers = new Headers({
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });
    const contentType = getUploadContentType(storageKey);
    if (contentType) {
      headers.set("Content-Type", contentType);
    }

    if (media.storageProvider === "vercel-blob") {
      const blob = await getPrivateJournalMedia(storageKey);
      if (!blob?.stream) {
        return new Response("Not found", { status: 404 });
      }

      return new Response(blob.stream, { headers });
    }

    const diskPath = getUploadDiskPath(storageKey);
    if (!diskPath) {
      return new Response("Not found", { status: 404 });
    }

    try {
      const file = await readFile(diskPath);
      return new Response(file, { headers });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return new Response("Not found", { status: 404 });
      }

      throw error;
    }
  }

  const diskPath = getUploadDiskPath(storageKey);
  if (!diskPath) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const file = await readFile(diskPath);
    const headers = new Headers({
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });
    const contentType = getUploadContentType(storageKey);
    if (contentType) {
      headers.set("Content-Type", contentType);
    }

    return new Response(file, { headers });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return new Response("Not found", { status: 404 });
    }

    throw error;
  }
}

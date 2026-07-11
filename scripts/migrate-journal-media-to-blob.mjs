import { randomUUID } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MIME_TYPES = {
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

function getLegacyUploadDirectory() {
  const configuredDirectory = process.env.FILAZO_UPLOAD_DIR?.trim();
  if (configuredDirectory) {
    return path.resolve(configuredDirectory);
  }

  if (process.env.VERCEL || process.cwd().startsWith("/var/task")) {
    return path.join(os.tmpdir(), "filazo-uploads");
  }

  return path.join(process.cwd(), "public", "uploads");
}

function getLegacyDiskPath(storageKey) {
  const segments = storageKey.split("/").filter(Boolean);
  if (segments[0] !== "uploads" || segments[1] !== "journal") {
    return null;
  }

  const root = path.resolve(getLegacyUploadDirectory());
  const target = path.resolve(root, ...segments.slice(1));
  return target.startsWith(`${root}${path.sep}`) ? target : null;
}

function getMimeType(media) {
  const fromDatabase = media.mimeType.toLowerCase().split(";", 1)[0].trim();
  if (Object.values(MIME_TYPES).includes(fromDatabase)) {
    return fromDatabase;
  }

  return MIME_TYPES[path.extname(media.storageKey).toLowerCase()] ?? null;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Set BLOB_READ_WRITE_TOKEN before migrating journal media.");
  }

  const mediaRows = await prisma.journalMedia.findMany({
    where: {
      storageProvider: "filesystem",
      storageKey: { startsWith: "uploads/journal/" },
    },
    include: {
      journalEntry: { select: { userId: true } },
    },
  });

  let migrated = 0;
  let missing = 0;
  let skipped = 0;

  for (const media of mediaRows) {
    const diskPath = getLegacyDiskPath(media.storageKey);
    const mimeType = getMimeType(media);
    if (!diskPath || !mimeType) {
      skipped += 1;
      console.warn(`Skipped ${media.id}: unsupported path or file type.`);
      continue;
    }

    try {
      await access(diskPath);
    } catch {
      missing += 1;
      console.warn(`Missing local file for ${media.id}: ${diskPath}`);
      continue;
    }

    const extension = path.extname(media.storageKey).toLowerCase();
    const pathname = `journal/${media.journalEntry.userId}/${randomUUID()}${extension}`;
    const file = await readFile(diskPath);
    await put(pathname, file, {
      access: "private",
      addRandomSuffix: false,
      contentType: mimeType,
    });

    const storageKey = `uploads/${pathname}`;
    await prisma.journalMedia.update({
      where: { id: media.id },
      data: {
        storageProvider: "vercel-blob",
        storageKey,
        url: `/${storageKey}`,
        mimeType,
        sizeBytes: file.byteLength,
      },
    });
    migrated += 1;
  }

  console.log({ migrated, missing, skipped, total: mediaRows.length });
  console.log("Local files were intentionally retained; remove them only after playback verification.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

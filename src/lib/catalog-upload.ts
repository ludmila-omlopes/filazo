import { get, head } from "@vercel/blob";
import { canUploadCatalogPath, type CatalogUpload } from "./catalog-upload-policy";
import { getAllowedUploadExtension, getAllowedUploadMimeType } from "./upload-file-type";

export async function readBoundedImage(stream: ReadableStream<Uint8Array>, maxBytes: number) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("Uploaded image is too large.");
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

function matchesImageHeader(bytes: Buffer, mime: string) {
  if (mime === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/gif") return ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"));
  if (mime === "image/webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export async function resolveCatalogUpload(payload: CatalogUpload, userId: string, maxBytes: number) {
  // Only exact paths in the authenticated owner's namespace, never caller URLs.
  if (!canUploadCatalogPath(payload.pathname, userId)) throw new Error("Invalid catalog upload path.");
  const metadata = await head(payload.pathname);
  const mime = getAllowedUploadMimeType(metadata.contentType, "image");
  const extension = mime && getAllowedUploadExtension(mime, "image");
  if (!mime || !extension || !payload.pathname.endsWith(extension) || metadata.size <= 0 || metadata.size > maxBytes) {
    throw new Error("Invalid uploaded image size or format.");
  }
  const result = await get(payload.pathname, { access: "private", useCache: false });
  if (!result?.stream) throw new Error("Uploaded image is unavailable.");
  const bytes = await readBoundedImage(result.stream, maxBytes);
  if (bytes.length !== metadata.size || !matchesImageHeader(bytes, mime)) throw new Error("Invalid image contents.");
  const fileName = payload.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 90) || `catalog${extension}`;
  return {
    file: new File([new Uint8Array(bytes)], fileName, { type: mime }),
    fileName, mimeType: mime, sizeBytes: bytes.length,
    url: `/uploads/${payload.pathname}`,
  };
}

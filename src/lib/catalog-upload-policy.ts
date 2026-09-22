import { z } from "zod";
import { getAllowedUploadExtensions, getAllowedUploadMimeType } from "./upload-file-type.ts";

export const CSV_MAX_BYTES = 1024 * 1024;
export const CATALOG_UPLOAD_REQUEST_MAX_BYTES = 16 * 1024;
export const catalogUploadSchema = z.object({
  pathname: z.string().max(320),
  fileName: z.string().trim().min(1).max(255),
});
export const catalogUploadsSchema = z.array(catalogUploadSchema).min(1).max(10)
  .refine(items => new Set(items.map(item => item.pathname)).size === items.length);
export type CatalogUpload = z.infer<typeof catalogUploadSchema>;

export function canUploadCatalogPath(pathname: string, userId: string) {
  const prefix = `imports/${userId}/`;
  if (!pathname.startsWith(prefix)) return false;
  const name = pathname.slice(prefix.length);
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-z]+$/i.test(name)
    && getAllowedUploadExtensions("image").has(`.${name.split(".").pop()}`);
}

export function validCatalogImage(file: { size: number; type: string }, maxBytes: number) {
  return file.size > 0 && file.size <= maxBytes && Boolean(getAllowedUploadMimeType(file.type, "image"));
}

export function csvFits(text: string) {
  return new TextEncoder().encode(text).byteLength <= CSV_MAX_BYTES;
}

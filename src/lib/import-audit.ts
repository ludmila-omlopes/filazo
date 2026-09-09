type ImportAuditRow = {
  rawData: unknown;
};

export type ImportSourceImage = {
  fileName: string | null;
  url: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readSourceImage(value: unknown): ImportSourceImage | null {
  const record = asRecord(value);
  const url = record?.url ?? record?.sourceImageUrl;

  if (typeof url !== "string" || !url.startsWith("/uploads/imports/")) {
    return null;
  }

  return {
    fileName: typeof record?.fileName === "string" ? record.fileName : null,
    url,
  };
}

export function isPhotoImport(columnMapping: unknown) {
  return asRecord(columnMapping)?.source === "photo-import";
}

export function getImportSourceImages({
  rows,
  summary,
}: {
  rows: ImportAuditRow[];
  summary: unknown;
}) {
  const summaryRecord = asRecord(summary);
  const storedImages = Array.isArray(summaryRecord?.sourceImages)
    ? summaryRecord.sourceImages
    : [];
  const rowImages = rows.map((row) => row.rawData);
  const images = [...storedImages, ...rowImages]
    .map(readSourceImage)
    .filter((image): image is ImportSourceImage => Boolean(image));
  const uniqueImages = new Map<string, ImportSourceImage>();

  for (const image of images) {
    const existing = uniqueImages.get(image.url);
    if (!existing || (!existing.fileName && image.fileName)) {
      uniqueImages.set(image.url, image);
    }
  }

  return Array.from(uniqueImages.values());
}

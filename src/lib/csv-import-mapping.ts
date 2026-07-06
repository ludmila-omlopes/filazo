import { z } from "zod";

function optionalColumn(value: unknown) {
  const column = String(value ?? "").trim();
  return column || undefined;
}

export const csvColumnMappingSchema = z
  .object({
    title: z.string().trim().min(1),
    platform: z.preprocess(optionalColumn, z.string().optional()),
    status: z.preprocess(optionalColumn, z.string().optional()),
    playtimeHours: z.preprocess(optionalColumn, z.string().optional()),
    completionPercent: z.preprocess(optionalColumn, z.string().optional()),
    notes: z.preprocess(optionalColumn, z.string().optional()),
    externalId: z.preprocess(optionalColumn, z.string().optional()),
    provider: z.enum(["PLAYSTATION", "XBOX"]).optional(),
  })
  .strict();

export type CsvColumnMapping = z.infer<typeof csvColumnMappingSchema>;

export function parseCsvColumnMappingJson(rawValue: string) {
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    const result = csvColumnMappingSchema.safeParse(parsed);
    if (!result.success) {
      return null;
    }

    return Object.fromEntries(
      Object.entries(result.data).filter(([, value]) => value !== undefined),
    ) as CsvColumnMapping;
  } catch {
    return null;
  }
}

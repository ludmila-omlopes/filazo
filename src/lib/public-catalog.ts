import type { PrismaClient } from "@prisma/client";
import { normalizeTitle } from "./utils.ts";

export const PUBLIC_CATALOG_PAGE_SIZE = 24;
const MAX_PAGE = 1000;
type SearchParams = Record<string, string | string[] | undefined>;

export function parsePublicCatalogParams(params: SearchParams) {
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const page = typeof params.page === "string" && /^\d{1,4}$/.test(params.page)
    ? Math.min(MAX_PAGE, Math.max(1, Number(params.page))) : 1;
  return { q, page };
}

export function publicCatalogHref(q: string, page = 1) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  return `/catalog${params.size ? `?${params}` : ""}`;
}

/** Read only the canonical catalog; no personal records, counts or provider calls. */
export async function readPublicCatalog(db: Pick<PrismaClient, "game">, params: SearchParams) {
  const { q, page } = parsePublicCatalogParams(params);
  const normalized = normalizeTitle(q);
  const rows = await db.game.findMany({
    where: q ? { OR: [
      { name: { contains: q, mode: "insensitive" } },
      ...(normalized ? [{ normalizedName: { contains: normalized } }] : []),
    ] } : {},
    select: { slug: true, name: true, coverUrl: true },
    orderBy: [{ normalizedName: "asc" }, { slug: "asc" }],
    skip: (page - 1) * PUBLIC_CATALOG_PAGE_SIZE,
    take: PUBLIC_CATALOG_PAGE_SIZE + 1,
  });
  return {
    q, page,
    games: rows.slice(0, PUBLIC_CATALOG_PAGE_SIZE),
    hasNext: page < MAX_PAGE && rows.length > PUBLIC_CATALOG_PAGE_SIZE,
  };
}

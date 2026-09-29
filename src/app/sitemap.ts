import type { MetadataRoute } from "next";
import { getSitemapGames } from "@/lib/catalog";
import { reportDatabaseError } from "@/lib/database-errors";
import { getSiteUrl } from "@/lib/site-metadata";

// Regenerated in the background so newly enriched game pages appear without a deploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const absolute = (path: string) => new URL(path, siteUrl).toString();
  const pages: MetadataRoute.Sitemap = [
    { url: absolute("/"), changeFrequency: "weekly", priority: 1 },
    { url: absolute("/catalog"), changeFrequency: "daily", priority: 0.8 },
    { url: absolute("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: absolute("/terms"), changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const games = await getSitemapGames();
    return [
      ...pages,
      ...games.map((game) => ({
        // Same path as the page's canonical URL.
        url: absolute(`/games/${game.slug}`),
        lastModified: game.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ];
  } catch (error) {
    // Builds without a database (CI) still get a valid sitemap of static pages.
    console.error("Could not load sitemap games.", error);
    reportDatabaseError(error, { operation: "load-sitemap-games", route: "/sitemap.xml" });
    return pages;
  }
}

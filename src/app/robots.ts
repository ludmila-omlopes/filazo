import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-metadata";

// Commercial SEO and data crawlers bring no visitors, but each game page they
// open is rendered from the database, which keeps it from scaling to zero.
// Search engines, AI assistants and link previews stay allowed.
const BLOCKED_CRAWLERS = [
  "PetalBot",
  "SemrushBot",
  "AhrefsBot",
  "Amazonbot",
  "meta-externalagent",
  "ExaSearchBot",
  "Bytespider",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/auth",
          "/dev",
          "/login",
          "/profile",
          "/tonight",
          "/uploads",
        ],
      },
      { userAgent: BLOCKED_CRAWLERS, disallow: "/" },
    ],
    host: getSiteUrl().origin,
    sitemap: new URL("/sitemap.xml", getSiteUrl()).toString(),
  };
}

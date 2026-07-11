import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
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
    host: getSiteUrl().origin,
  };
}

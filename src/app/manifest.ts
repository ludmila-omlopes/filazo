import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site-metadata";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    scope: "/",
    start_url: "/profile",
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    display: "standalone",
    background_color: "#f7f5f0",
    theme_color: "#343542",
    categories: ["games", "lifestyle"],
    icons: [
      {
        src: "/icons/filazo-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/filazo-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/filazo-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Catalog",
        short_name: "Catalog",
        description: "Browse your game library",
        url: "/profile?tab=games",
        icons: [
          {
            src: "/icons/filazo-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "Tonight",
        short_name: "Tonight",
        description: "Choose what to play next",
        url: "/tonight",
        icons: [
          {
            src: "/icons/filazo-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "Journal",
        short_name: "Journal",
        description: "Add a memory from a game",
        url: "/profile?tab=journal",
        icons: [
          {
            src: "/icons/filazo-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
  };
}

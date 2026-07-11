import type { Metadata } from "next";

export const SITE_NAME = "filazo";
export const SITE_DESCRIPTION =
  "A calm catalog for your game library. Sync your collection, keep every title organized, and choose what to play next.";
export const SOCIAL_IMAGE_ALT =
  "filazo — a calm catalog for your game library";

const LOCAL_SITE_URL = "http://localhost:3001";

export function getSiteUrl() {
  const configuredUrl = process.env.APP_URL?.trim();

  if (!configuredUrl) {
    return new URL(LOCAL_SITE_URL);
  }

  try {
    const url = new URL(configuredUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return new URL(LOCAL_SITE_URL);
    }

    return url;
  } catch {
    return new URL(LOCAL_SITE_URL);
  }
}

export function createPageMetadata({
  description,
  path,
  title,
}: {
  description: string;
  path: string;
  title: string;
}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: "website",
      url: path,
      images: [
        {
          url: "/opengraph-image.png",
          width: 1200,
          height: 630,
          alt: SOCIAL_IMAGE_ALT,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        {
          url: "/twitter-image.png",
          width: 1200,
          height: 630,
          alt: SOCIAL_IMAGE_ALT,
        },
      ],
    },
  };
}

export const noIndexMetadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
} satisfies Metadata;

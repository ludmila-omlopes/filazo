export type RemoteImagePattern = {
  protocol: "https";
  hostname: string;
  pathname: `/${string}`;
};

export const remoteImagePatterns: RemoteImagePattern[] = [
  {
    protocol: "https",
    hostname: "images.igdb.com",
    pathname: "/igdb/image/upload/**",
  },
  {
    protocol: "https",
    hostname: "shared.fastly.steamstatic.com",
    pathname: "/store_item_assets/**",
  },
  {
    protocol: "https",
    hostname: "cdn.cloudflare.steamstatic.com",
    pathname: "/steam/apps/**",
  },
  {
    protocol: "https",
    hostname: "psnobj.prod.dl.playstation.net",
    pathname: "/psnobj/**",
  },
  {
    protocol: "https",
    hostname: "images-eds-ssl.xboxlive.com",
    pathname: "/**",
  },
  {
    protocol: "https",
    hostname: "store-images.s-microsoft.com",
    pathname: "/**",
  },
];

function matchesPathname(pathname: string, pattern: string) {
  if (pattern.endsWith("/**")) {
    return pathname.startsWith(pattern.slice(0, -2));
  }

  return pathname === pattern;
}

export function isAllowedImageUrl(source: string) {
  if (source.startsWith("/") && !source.startsWith("//")) {
    return true;
  }

  try {
    const url = new URL(source);
    return remoteImagePatterns.some(
      (pattern) =>
        url.protocol === `${pattern.protocol}:` &&
        url.hostname === pattern.hostname &&
        matchesPathname(url.pathname, pattern.pathname),
    );
  } catch {
    return false;
  }
}

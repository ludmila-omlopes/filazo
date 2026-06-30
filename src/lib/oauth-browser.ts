const APP_ROUTE_ORIGIN = "https://filazo.local";

const EMBEDDED_BROWSER_TOKENS = [
  "bytedancewebview",
  "barcelona",
  "fb_iab",
  "fban",
  "fbav",
  "instagram",
  "linkedinapp",
  "line/",
  "micromessenger",
  "pinterest",
  "snapchat",
  "threads",
  "tiktok",
  "twitter",
  "x-twitter",
];

const SAFE_OAUTH_RETURN_PATHS = new Set(["/admin", "/beta", "/login"]);

export function isGoogleOAuthBlockedUserAgent(userAgent: string | null) {
  const normalized = userAgent?.toLowerCase() ?? "";

  if (!normalized) {
    return false;
  }

  if (normalized.includes("; wv") || normalized.includes(" wv;")) {
    return true;
  }

  if (EMBEDDED_BROWSER_TOKENS.some((token) => normalized.includes(token))) {
    return true;
  }

  const isIosWebView =
    /\b(ipad|iphone|ipod)\b/.test(normalized) &&
    normalized.includes("applewebkit") &&
    normalized.includes("mobile") &&
    !/\b(safari|crios|fxios|edgios)\b/.test(normalized);

  return isIosWebView;
}

function normalizeAppPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  try {
    const url = new URL(value, APP_ROUTE_ORIGIN);
    if (url.origin !== APP_ROUTE_ORIGIN) {
      return null;
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function getSafeOAuthReturnPath(
  value: string | null | undefined,
  fallback: string,
) {
  const fallbackPath = normalizeAppPath(fallback) ?? "/login?auth=1";
  const path = normalizeAppPath(value);

  if (!path) {
    return fallbackPath;
  }

  const url = new URL(path, APP_ROUTE_ORIGIN);
  if (!SAFE_OAUTH_RETURN_PATHS.has(url.pathname)) {
    return fallbackPath;
  }

  return path;
}

export function createBrowserRequiredUrl(
  requestUrl: string | URL,
  returnPath: string,
) {
  const url = new URL("/auth/browser-required", requestUrl);
  url.searchParams.set("next", getSafeOAuthReturnPath(returnPath, "/login?auth=1"));
  return url;
}

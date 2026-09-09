import {
  ExternalProvider,
  type ExternalAccount,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ProviderProfile,
  SyncedLibraryGame,
} from "@/lib/providers/contracts";
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  type EncryptedSecret,
} from "@/lib/secret-crypto";

const GOG_AUTH_URL = "https://auth.gog.com/auth";
const GOG_TOKEN_URL = "https://auth.gog.com/token";
const GOG_EMBED_URL = "https://embed.gog.com";
const GOG_DEFAULT_REDIRECT_URI =
  "https://embed.gog.com/on_login_success?origin=client";
const GOG_MAX_LIBRARY_PAGES = 100;

type GogTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type GogAuthMetadata = {
  accessToken?: EncryptedSecret;
  accessTokenExpiresAt?: string;
  refreshToken?: EncryptedSecret;
  scope?: string;
  tokenType?: string;
};

type GogAccountMetadata = {
  auth?: GogAuthMetadata;
  connectedAt?: string;
  lastTokenRefreshAt?: string;
  profile?: ProviderProfile;
  syncMode?: "owned-library";
};

type GogProduct = Record<string, unknown> & {
  id?: string | number;
  image?: string;
  images?: Record<string, unknown>;
  isGame?: boolean;
  isMovie?: boolean;
  slug?: string;
  title?: string;
  url?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createGogError(
  message: string,
  code: "AUTH" | "CONFIGURATION" | "PROVIDER",
) {
  return Object.assign(new Error(message), { platformSyncErrorCode: code });
}

function getGogConfig() {
  const clientId = process.env.GOG_CLIENT_ID?.trim();
  const clientSecret = process.env.GOG_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOG_REDIRECT_URI?.trim() || GOG_DEFAULT_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    throw createGogError(
      "GOG browser login is not configured for this site.",
      "CONFIGURATION",
    );
  }

  return { clientId, clientSecret, redirectUri };
}

export function isGogConfigured() {
  return Boolean(
    process.env.GOG_CLIENT_ID?.trim() &&
      process.env.GOG_CLIENT_SECRET?.trim(),
  );
}

export function createGogAuthUrl(state: string) {
  const { clientId, redirectUri } = getGogConfig();
  const url = new URL(GOG_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("layout", "client2");
  url.searchParams.set("brand", "gog");
  url.searchParams.set("state", state);
  return url;
}

export function parseGogRedirectUrl(
  value: string,
  expectedState: string,
  redirectUri = process.env.GOG_REDIRECT_URI?.trim() || GOG_DEFAULT_REDIRECT_URI,
) {
  let returnedUrl: URL;
  let expectedUrl: URL;
  try {
    returnedUrl = new URL(value.trim());
    expectedUrl = new URL(redirectUri);
  } catch {
    throw createGogError("Paste the complete URL returned by GOG.", "AUTH");
  }

  if (
    returnedUrl.protocol !== "https:" ||
    returnedUrl.origin !== expectedUrl.origin ||
    returnedUrl.pathname !== expectedUrl.pathname
  ) {
    throw createGogError("The pasted URL was not returned by GOG.", "AUTH");
  }

  const code = returnedUrl.searchParams.get("code")?.trim();
  const state = returnedUrl.searchParams.get("state")?.trim();
  if (!code) {
    throw createGogError("GOG did not return an authorization code.", "AUTH");
  }
  if (!state || !expectedState || state !== expectedState) {
    throw createGogError("GOG sign-in state could not be verified.", "AUTH");
  }

  return code;
}

async function requestGogJson(
  url: URL | string,
  options: {
    accessToken?: string;
    errorMessage: string;
    signal?: AbortSignal;
  },
) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(options.accessToken
        ? { Authorization: `Bearer ${options.accessToken}` }
        : {}),
    },
    signal: options.signal,
  });

  if (!response.ok) {
    const code =
      response.status === 401 || response.status === 403
        ? "AUTH"
        : response.status === 400
          ? "CONFIGURATION"
          : "PROVIDER";
    throw createGogError(
      `${options.errorMessage} (${response.status}).`,
      code,
    );
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    throw createGogError(
      `${options.errorMessage}: GOG returned an invalid response.`,
      "PROVIDER",
    );
  }
}

function parseTokenResponse(value: unknown): GogTokenResponse {
  if (
    !isRecord(value) ||
    typeof value.access_token !== "string" ||
    typeof value.expires_in !== "number"
  ) {
    throw createGogError("GOG returned invalid OAuth tokens.", "AUTH");
  }

  return {
    access_token: value.access_token,
    expires_in: value.expires_in,
    refresh_token:
      typeof value.refresh_token === "string" ? value.refresh_token : undefined,
    scope: typeof value.scope === "string" ? value.scope : undefined,
    token_type:
      typeof value.token_type === "string" ? value.token_type : undefined,
  };
}

async function requestGogToken(
  input:
    | { code: string; grantType: "authorization_code" }
    | { grantType: "refresh_token"; refreshToken: string },
  signal?: AbortSignal,
) {
  const { clientId, clientSecret, redirectUri } = getGogConfig();
  const url = new URL(GOG_TOKEN_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", input.grantType);
  if (input.grantType === "authorization_code") {
    url.searchParams.set("code", input.code);
    url.searchParams.set("redirect_uri", redirectUri);
  } else {
    url.searchParams.set("refresh_token", input.refreshToken);
  }

  return parseTokenResponse(
    await requestGogJson(url, {
      errorMessage: "Could not exchange credentials with GOG",
      signal,
    }),
  );
}

function createAuthMetadata(
  tokens: GogTokenResponse,
  fallbackRefreshToken?: EncryptedSecret,
  now = new Date(),
): GogAuthMetadata {
  return {
    accessToken: encryptSecret(tokens.access_token),
    accessTokenExpiresAt: new Date(
      now.getTime() + tokens.expires_in * 1000,
    ).toISOString(),
    refreshToken: tokens.refresh_token
      ? encryptSecret(tokens.refresh_token)
      : fallbackRefreshToken,
    scope: tokens.scope,
    tokenType: tokens.token_type,
  };
}

function parseGogMetadata(
  value: Prisma.JsonValue | null,
): GogAccountMetadata {
  if (!isRecord(value)) return {};
  const auth = isRecord(value.auth) ? value.auth : {};

  return {
    auth: {
      accessToken: isEncryptedSecret(auth.accessToken)
        ? auth.accessToken
        : undefined,
      accessTokenExpiresAt:
        typeof auth.accessTokenExpiresAt === "string"
          ? auth.accessTokenExpiresAt
          : undefined,
      refreshToken: isEncryptedSecret(auth.refreshToken)
        ? auth.refreshToken
        : undefined,
      scope: typeof auth.scope === "string" ? auth.scope : undefined,
      tokenType:
        typeof auth.tokenType === "string" ? auth.tokenType : undefined,
    },
    connectedAt:
      typeof value.connectedAt === "string" ? value.connectedAt : undefined,
    lastTokenRefreshAt:
      typeof value.lastTokenRefreshAt === "string"
        ? value.lastTokenRefreshAt
        : undefined,
    profile: isRecord(value.profile)
      ? (value.profile as GogAccountMetadata["profile"])
      : undefined,
    syncMode: value.syncMode === "owned-library" ? value.syncMode : undefined,
  };
}

function isFutureDate(value: string | undefined, skewMs = 60_000) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now() + skewMs;
}

function getAvatarUrl(value: Record<string, unknown>) {
  const avatar = isRecord(value.avatar) ? value.avatar : null;
  const avatars = isRecord(value.avatars) ? value.avatars : null;
  const candidate =
    avatar?.medium_2x ??
    avatar?.medium ??
    avatars?.medium_2x ??
    avatars?.medium2x ??
    avatars?.medium;
  return typeof candidate === "string" ? candidate : null;
}

async function fetchGogProfile(
  accessToken: string,
  signal?: AbortSignal,
): Promise<ProviderProfile> {
  const value = await requestGogJson(`${GOG_EMBED_URL}/userData.json`, {
    accessToken,
    errorMessage: "Could not load the GOG profile",
    signal,
  });
  if (!isRecord(value) || value.isLoggedIn === false) {
    throw createGogError("GOG did not return a signed-in profile.", "AUTH");
  }

  const accountId = value.userId ?? value.galaxyUserId;
  if (
    (typeof accountId !== "string" && typeof accountId !== "number") ||
    !String(accountId).trim()
  ) {
    throw createGogError("GOG did not return an account identifier.", "AUTH");
  }
  const username =
    typeof value.username === "string" ? value.username : undefined;

  return {
    providerAccountId: String(accountId),
    username,
    displayName: username ?? `GOG ${String(accountId).slice(-4)}`,
    avatarUrl: getAvatarUrl(value),
    profileUrl: username
      ? `https://www.gog.com/u/${encodeURIComponent(username)}`
      : null,
    metadata: {
      country: typeof value.country === "string" ? value.country : undefined,
      preferredLanguage: isRecord(value.preferredLanguage)
        ? value.preferredLanguage
        : undefined,
    },
  };
}

async function getAuthorizationForAccount(
  account: ExternalAccount,
  signal?: AbortSignal,
) {
  const metadata = parseGogMetadata(account.metadata);
  if (
    metadata.auth?.accessToken &&
    isFutureDate(metadata.auth.accessTokenExpiresAt)
  ) {
    return {
      accessToken: decryptSecret(metadata.auth.accessToken),
      metadata,
    };
  }

  if (!metadata.auth?.refreshToken) {
    throw createGogError(
      "GOG token expired. Connect GOG again in Sources.",
      "AUTH",
    );
  }

  const tokens = await requestGogToken(
    {
      grantType: "refresh_token",
      refreshToken: decryptSecret(metadata.auth.refreshToken),
    },
    signal,
  );
  const nextMetadata: GogAccountMetadata = {
    ...metadata,
    auth: createAuthMetadata(tokens, metadata.auth.refreshToken),
    lastTokenRefreshAt: new Date().toISOString(),
  };
  await prisma.externalAccount.update({
    where: { id: account.id },
    data: { metadata: nextMetadata as Prisma.InputJsonValue },
  });

  return { accessToken: tokens.access_token, metadata: nextMetadata };
}

export async function connectGogAccountForUser({
  code,
  userId,
}: {
  code: string;
  userId: string;
}) {
  const tokens = await requestGogToken({
    code,
    grantType: "authorization_code",
  });
  const profile = await fetchGogProfile(tokens.access_token);
  const [user, connectedAccount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.externalAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: ExternalProvider.GOG,
          providerAccountId: profile.providerAccountId,
        },
      },
      select: { userId: true },
    }),
  ]);
  if (!user) throw new Error("Sign in before connecting GOG.");
  if (connectedAccount && connectedAccount.userId !== userId) {
    throw new Error("This GOG account is already connected to another user.");
  }

  const metadata: GogAccountMetadata = {
    auth: createAuthMetadata(tokens),
    connectedAt: new Date().toISOString(),
    profile,
    syncMode: "owned-library",
  };

  await prisma.user.update({
    where: { id: userId },
    data: {
      displayName: user.displayName ?? profile.displayName ?? undefined,
      avatarUrl: user.avatarUrl ?? profile.avatarUrl ?? undefined,
    },
  });

  return prisma.externalAccount.upsert({
    where: {
      provider_providerAccountId: {
        provider: ExternalProvider.GOG,
        providerAccountId: profile.providerAccountId,
      },
    },
    update: {
      userId,
      username: profile.username ?? undefined,
      displayName: profile.displayName ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
      profileUrl: profile.profileUrl ?? undefined,
      metadata: metadata as Prisma.InputJsonValue,
    },
    create: {
      userId,
      provider: ExternalProvider.GOG,
      providerAccountId: profile.providerAccountId,
      username: profile.username ?? undefined,
      displayName: profile.displayName ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
      profileUrl: profile.profileUrl ?? undefined,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

function normalizeGogImageUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.startsWith("//")) return `https:${value}`;
  return value.startsWith("https://") ? value : null;
}

function getProductGameType(product: GogProduct) {
  const gameType = product.game_type ?? product.gameType;
  return typeof gameType === "string" ? gameType.toLowerCase() : null;
}

export function mapGogProductToSyncedGame(
  product: GogProduct,
): SyncedLibraryGame | null {
  const providerGameId =
    typeof product.id === "number" || typeof product.id === "string"
      ? String(product.id).trim()
      : "";
  const title = typeof product.title === "string" ? product.title.trim() : "";
  const gameType = getProductGameType(product);
  if (
    !providerGameId ||
    !title ||
    product.isMovie === true ||
    product.isGame === false ||
    (gameType !== null && gameType !== "game")
  ) {
    return null;
  }

  const slug = typeof product.slug === "string" ? product.slug.trim() : "";
  const relativeUrl =
    typeof product.url === "string" && product.url.startsWith("/")
      ? product.url
      : null;
  const storeUrl = relativeUrl
    ? new URL(relativeUrl, "https://www.gog.com").toString()
    : slug
      ? `https://www.gog.com/game/${encodeURIComponent(slug)}`
      : null;
  const images = isRecord(product.images) ? product.images : {};

  return {
    providerGameId,
    title,
    platformName: "GOG",
    storeUrl,
    rawData: {
      gameType,
      image: normalizeGogImageUrl(product.image),
      images: {
        background: normalizeGogImageUrl(images.background),
        logo: normalizeGogImageUrl(images.logo),
        logo2x: normalizeGogImageUrl(images.logo2x),
      },
      slug: slug || null,
      worksOn: isRecord(product.worksOn)
        ? product.worksOn
        : isRecord(product.content_system_compatibility)
          ? product.content_system_compatibility
          : undefined,
    },
  };
}

async function fetchGogOwnedLibrary(
  accessToken: string,
  signal?: AbortSignal,
) {
  const games: SyncedLibraryGame[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= GOG_MAX_LIBRARY_PAGES) {
    const url = new URL(`${GOG_EMBED_URL}/account/getFilteredProducts`);
    url.searchParams.set("mediaType", "1");
    url.searchParams.set("sortBy", "title");
    url.searchParams.set("page", String(page));
    const value = await requestGogJson(url, {
      accessToken,
      errorMessage: "Could not load the GOG library",
      signal,
    });
    if (!isRecord(value) || !Array.isArray(value.products)) {
      throw createGogError(
        "GOG returned an unexpected library response.",
        "PROVIDER",
      );
    }

    for (const candidate of value.products) {
      if (!isRecord(candidate)) continue;
      const game = mapGogProductToSyncedGame(candidate);
      if (game) games.push(game);
    }

    const returnedTotalPages = Number(value.totalPages);
    if (!Number.isInteger(returnedTotalPages) || returnedTotalPages < 0) {
      throw createGogError(
        "GOG returned invalid library pagination.",
        "PROVIDER",
      );
    }
    totalPages = returnedTotalPages;
    page += 1;
  }

  if (totalPages > GOG_MAX_LIBRARY_PAGES) {
    throw createGogError("The GOG library exceeded the safe page limit.", "PROVIDER");
  }
  return games;
}

export async function syncGogLibraryForAccount(
  account: ExternalAccount,
  options: { signal?: AbortSignal } = {},
) {
  const { accessToken, metadata } = await getAuthorizationForAccount(
    account,
    options.signal,
  );
  const [profile, games] = await Promise.all([
    fetchGogProfile(accessToken, options.signal),
    fetchGogOwnedLibrary(accessToken, options.signal),
  ]);
  const nextMetadata: GogAccountMetadata = {
    ...metadata,
    profile,
    syncMode: "owned-library",
  };
  await prisma.externalAccount.update({
    where: { id: account.id },
    data: {
      username: profile.username ?? undefined,
      displayName: profile.displayName ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
      profileUrl: profile.profileUrl ?? undefined,
      metadata: nextMetadata as Prisma.InputJsonValue,
    },
  });

  return { games, profile };
}

export function getGogArtworkFallback(rawData: Record<string, unknown> | undefined) {
  if (!rawData) return null;
  const images = isRecord(rawData.images) ? rawData.images : {};
  const coverUrl =
    normalizeGogImageUrl(images.logo2x) ??
    normalizeGogImageUrl(images.logo) ??
    normalizeGogImageUrl(rawData.image);
  const heroUrl = normalizeGogImageUrl(images.background);
  return coverUrl || heroUrl ? { coverUrl, heroUrl } : null;
}

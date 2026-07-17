import crypto from "node:crypto";
import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getProfileFromAccountId,
  getPurchasedGames,
  getUserPlayedGames,
  getUserTitles,
  getUserTrophyProfileSummary,
  type AuthTokensResponse,
  type AuthorizationPayload,
  type PurchasedGame,
  type TrophyTitle,
} from "psn-api";
import { ExternalProvider, type ExternalAccount, type Prisma } from "@prisma/client";
import { getAuthSecret } from "@/lib/auth-secret";
import {
  isPlayStationNonGameCategory,
  mapPlayedGameToSyncedGame,
  mapPurchasedGameToSyncedGame,
  mapTitleToSyncedGame,
  mergePlayStationSyncedGames,
  type PlayStationPlayedGame,
} from "@/lib/playstation-library";
import { prisma } from "@/lib/prisma";
import type { ProviderProfile } from "@/lib/providers/contracts";

const PLAYSTATION_TITLES_PAGE_SIZE = 800;
const PLAYSTATION_PURCHASED_PAGE_SIZE = 100;
const PLAYSTATION_PLAYED_PAGE_SIZE = 200;

type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  tag: string;
};

type PlayStationAuthMetadata = {
  accessToken?: EncryptedSecret;
  accessTokenExpiresAt?: string;
  refreshToken?: EncryptedSecret;
  refreshTokenExpiresAt?: string;
  scope?: string;
  tokenType?: string;
};

type PlayStationAccountMetadata = {
  auth?: PlayStationAuthMetadata;
  profile?: ProviderProfile;
  trophySummary?: Record<string, unknown>;
  connectedAt?: string;
  lastTokenRefreshAt?: string;
  syncMode?: "played-trophy-titles" | "hybrid-library-and-trophy-titles";
};

function getTokenEncryptionKey() {
  const secret = getAuthSecret();
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptSecret(value: string): EncryptedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getTokenEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptSecret(secret: EncryptedSecret) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getTokenEncryptionKey(),
    Buffer.from(secret.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEncryptedSecret(value: unknown): value is EncryptedSecret {
  return (
    isRecord(value) &&
    typeof value.ciphertext === "string" &&
    typeof value.iv === "string" &&
    typeof value.tag === "string"
  );
}

function parsePlayStationMetadata(
  value: Prisma.JsonValue | null,
): PlayStationAccountMetadata {
  if (!isRecord(value)) {
    return {};
  }

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
      refreshTokenExpiresAt:
        typeof auth.refreshTokenExpiresAt === "string"
          ? auth.refreshTokenExpiresAt
          : undefined,
      scope: typeof auth.scope === "string" ? auth.scope : undefined,
      tokenType: typeof auth.tokenType === "string" ? auth.tokenType : undefined,
    },
    profile: isRecord(value.profile)
      ? (value.profile as PlayStationAccountMetadata["profile"])
      : undefined,
    trophySummary: isRecord(value.trophySummary)
      ? value.trophySummary
      : undefined,
    connectedAt:
      typeof value.connectedAt === "string" ? value.connectedAt : undefined,
    lastTokenRefreshAt:
      typeof value.lastTokenRefreshAt === "string"
        ? value.lastTokenRefreshAt
        : undefined,
    syncMode:
      value.syncMode === "played-trophy-titles" ||
      value.syncMode === "hybrid-library-and-trophy-titles"
        ? value.syncMode
        : undefined,
  };
}

function createAuthMetadata(
  tokens: AuthTokensResponse,
  now = new Date(),
): PlayStationAuthMetadata {
  return {
    accessToken: encryptSecret(tokens.accessToken),
    accessTokenExpiresAt: new Date(
      now.getTime() + tokens.expiresIn * 1000,
    ).toISOString(),
    refreshToken: encryptSecret(tokens.refreshToken),
    refreshTokenExpiresAt: new Date(
      now.getTime() + tokens.refreshTokenExpiresIn * 1000,
    ).toISOString(),
    scope: tokens.scope,
    tokenType: tokens.tokenType,
  };
}

function isFutureDate(value: string | undefined, skewMs = 60_000) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now() + skewMs;
}

async function exchangeNpssoForAuth(npsso: string) {
  const trimmedNpsso = npsso.trim();
  if (trimmedNpsso.length < 32) {
    throw new Error("Enter a valid PlayStation NPSSO token.");
  }

  const accessCode = await exchangeNpssoForAccessCode(trimmedNpsso);
  return exchangeAccessCodeForAuthTokens(accessCode);
}

async function getAuthorizationForAccount(account: ExternalAccount) {
  const metadata = parsePlayStationMetadata(account.metadata);
  const accessToken = metadata.auth?.accessToken;

  if (
    accessToken &&
    isFutureDate(metadata.auth?.accessTokenExpiresAt)
  ) {
    return {
      authorization: {
        accessToken: decryptSecret(accessToken),
      },
      metadata,
    };
  }

  const refreshToken = metadata.auth?.refreshToken;
  if (!refreshToken || !isFutureDate(metadata.auth?.refreshTokenExpiresAt, 0)) {
    throw new Error(
      "PlayStation token expired. Connect PlayStation again with a fresh NPSSO.",
    );
  }

  const refreshedTokens = await exchangeRefreshTokenForAuthTokens(
    decryptSecret(refreshToken),
  );
  const nextMetadata: PlayStationAccountMetadata = {
    ...metadata,
    auth: createAuthMetadata(refreshedTokens),
    lastTokenRefreshAt: new Date().toISOString(),
  };

  await prisma.externalAccount.update({
    where: { id: account.id },
    data: {
      metadata: nextMetadata as Prisma.InputJsonValue,
    },
  });

  return {
    authorization: {
      accessToken: refreshedTokens.accessToken,
    },
    metadata: nextMetadata,
  };
}

export async function getPlayStationAuthorizationForAccount(
  account: ExternalAccount,
) {
  const { authorization } = await getAuthorizationForAccount(account);
  return authorization;
}

function pickAvatarUrl(profile: Awaited<ReturnType<typeof getProfileFromAccountId>> | null) {
  return profile?.avatars?.at(-1)?.url ?? profile?.avatars?.[0]?.url ?? null;
}

function createPlayStationProfile({
  accountId,
  profile,
  trophySummary,
}: {
  accountId: string;
  profile: Awaited<ReturnType<typeof getProfileFromAccountId>> | null;
  trophySummary: Awaited<ReturnType<typeof getUserTrophyProfileSummary>>;
}): ProviderProfile {
  return {
    providerAccountId: accountId,
    username: profile?.onlineId ?? null,
    displayName: profile?.onlineId ?? `PlayStation ${accountId.slice(-4)}`,
    avatarUrl: pickAvatarUrl(profile),
    profileUrl: profile?.onlineId
      ? `https://psnprofiles.com/${encodeURIComponent(profile.onlineId)}`
      : null,
    metadata: {
      isPlus: profile?.isPlus ?? null,
      trophyLevel: trophySummary.trophyLevel,
      trophyProgress: trophySummary.progress,
      trophyTier: trophySummary.tier,
    },
  };
}

async function fetchPlayStationProfile(
  authorization: AuthorizationPayload,
): Promise<{
  profile: ProviderProfile;
  trophySummary: Awaited<ReturnType<typeof getUserTrophyProfileSummary>>;
}> {
  const trophySummary = await getUserTrophyProfileSummary(authorization, "me");
  const accountId = trophySummary.accountId || "me";

  let profile: Awaited<ReturnType<typeof getProfileFromAccountId>> | null = null;
  try {
    profile = await getProfileFromAccountId(authorization, accountId);
  } catch {
    profile = null;
  }

  return {
    profile: createPlayStationProfile({
      accountId,
      profile,
      trophySummary,
    }),
    trophySummary,
  };
}

async function fetchPlayedTitles(authorization: AuthorizationPayload) {
  const titles: TrophyTitle[] = [];
  let offset = 0;
  let totalItemCount = Number.POSITIVE_INFINITY;

  while (offset < totalItemCount) {
    const page = await getUserTitles(authorization, "me", {
      limit: PLAYSTATION_TITLES_PAGE_SIZE,
      offset,
    });
    const pageTitles = page.trophyTitles ?? [];
    titles.push(...pageTitles);
    totalItemCount = page.totalItemCount ?? titles.length;

    if (pageTitles.length === 0) {
      break;
    }

    offset += pageTitles.length;
  }

  return titles.map(mapTitleToSyncedGame);
}

async function fetchPlayedGames(authorization: AuthorizationPayload) {
  const games: PlayStationPlayedGame[] = [];
  let offset = 0;
  let totalItemCount = Number.POSITIVE_INFINITY;

  while (offset < totalItemCount) {
    const page = await getUserPlayedGames(authorization, "me", {
      limit: PLAYSTATION_PLAYED_PAGE_SIZE,
      offset,
    });
    const rawPageGames = page.titles ?? [];
    const pageGames = rawPageGames.filter(
      (game) => !isPlayStationNonGameCategory(game.category),
    );
    games.push(...pageGames);
    totalItemCount = page.totalItemCount ?? games.length;

    if (rawPageGames.length === 0) {
      break;
    }

    offset += rawPageGames.length;
  }

  return games.map(mapPlayedGameToSyncedGame);
}

async function fetchPurchasedGames(authorization: AuthorizationPayload) {
  const games: PurchasedGame[] = [];
  let start = 0;

  while (true) {
    const page = await getPurchasedGames(authorization, {
      size: PLAYSTATION_PURCHASED_PAGE_SIZE,
      start,
    });
    const pageGames = page.data.purchasedTitlesRetrieve.games ?? [];
    games.push(...pageGames);

    if (pageGames.length < PLAYSTATION_PURCHASED_PAGE_SIZE) {
      break;
    }

    start += pageGames.length;
  }

  return games.map(mapPurchasedGameToSyncedGame);
}

export async function connectPlayStationAccountForUser({
  userId,
  npsso,
}: {
  userId: string;
  npsso: string;
}) {
  const tokens = await exchangeNpssoForAuth(npsso);
  const authorization = { accessToken: tokens.accessToken };
  const { profile, trophySummary } = await fetchPlayStationProfile(authorization);
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!existingUser) {
    throw new Error("Sign in before connecting PlayStation.");
  }

  const metadata: PlayStationAccountMetadata = {
    auth: createAuthMetadata(tokens),
    connectedAt: new Date().toISOString(),
    profile,
    syncMode: "hybrid-library-and-trophy-titles",
    trophySummary: trophySummary as unknown as Record<string, unknown>,
  };

  await prisma.user.update({
    where: { id: userId },
    data: {
      displayName: existingUser.displayName ?? profile.displayName ?? undefined,
      avatarUrl: existingUser.avatarUrl ?? profile.avatarUrl ?? undefined,
    },
  });

  return prisma.externalAccount.upsert({
    where: {
      provider_providerAccountId: {
        provider: ExternalProvider.PLAYSTATION,
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
      provider: ExternalProvider.PLAYSTATION,
      providerAccountId: profile.providerAccountId,
      username: profile.username ?? undefined,
      displayName: profile.displayName ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
      profileUrl: profile.profileUrl ?? undefined,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

export async function syncPlayStationLibraryForAccount(
  account: ExternalAccount,
) {
  const { authorization, metadata } = await getAuthorizationForAccount(account);
  const [profileResult, purchasedGames, trophyGames, playedGames] = await Promise.all([
    fetchPlayStationProfile(authorization),
    fetchPurchasedGames(authorization),
    fetchPlayedTitles(authorization),
    fetchPlayedGames(authorization),
  ]);
  const games = mergePlayStationSyncedGames(
    purchasedGames,
    trophyGames,
    playedGames,
  );

  const nextMetadata: PlayStationAccountMetadata = {
    ...metadata,
    profile: profileResult.profile,
    syncMode: "hybrid-library-and-trophy-titles",
    trophySummary: profileResult.trophySummary as unknown as Record<string, unknown>,
  };

  await prisma.externalAccount.update({
    where: { id: account.id },
    data: {
      username: profileResult.profile.username ?? undefined,
      displayName: profileResult.profile.displayName ?? undefined,
      avatarUrl: profileResult.profile.avatarUrl ?? undefined,
      profileUrl: profileResult.profile.profileUrl ?? undefined,
      metadata: nextMetadata as Prisma.InputJsonValue,
    },
  });

  return {
    games,
    profile: profileResult.profile,
  };
}

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
import { prisma } from "@/lib/prisma";
import type { ProviderProfile, SyncedLibraryGame } from "@/lib/providers/contracts";
import { normalizeTitle } from "@/lib/utils";

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
  const secret = process.env.AUTH_SECRET || "local-dev-secret-change-me";
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

function parsePlayStationDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function parsePlayStationDurationMinutes(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(
    /^P(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/,
  );
  if (!match) {
    return null;
  }

  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  const totalMinutes =
    Number(days.replace(",", ".")) * 24 * 60 +
    Number(hours.replace(",", ".")) * 60 +
    Number(minutes.replace(",", ".")) +
    Number(seconds.replace(",", ".")) / 60;

  return Number.isFinite(totalMinutes) ? Math.round(totalMinutes) : null;
}

function isPlayStationNonGameCategory(category: string | null | undefined) {
  if (!category) {
    return false;
  }

  const normalized = category.toLowerCase();
  return (
    normalized.includes("app") ||
    normalized.includes("media") ||
    normalized.includes("videoservice") ||
    normalized.includes("nongame")
  );
}

function getPlayStationPlayedPlatformName(category: string | null | undefined) {
  if (!category) {
    return "PlayStation";
  }

  const normalized = category.toLowerCase();
  if (normalized.includes("ps5")) {
    return normalizePlayStationPlatformName("PS5");
  }

  if (normalized.includes("ps4")) {
    return normalizePlayStationPlatformName("PS4");
  }

  if (normalized.includes("pspc")) {
    return normalizePlayStationPlatformName("PSPC");
  }

  return "PlayStation";
}

function normalizePlayStationPlatformName(value: string) {
  const normalized = value.trim().toUpperCase();

  if (normalized === "PS5") {
    return "PlayStation PS5";
  }

  if (normalized === "PS4") {
    return "PlayStation PS4";
  }

  if (normalized === "PSPC") {
    return "PlayStation PC";
  }

  if (normalized === "PSVR2") {
    return "PlayStation VR2";
  }

  return value.trim();
}

function formatPlayStationPlatform(value: string) {
  return uniqueValues(
    value
      .split(",")
      .map((platform) => normalizePlayStationPlatformName(platform))
      .filter(Boolean),
  ).join(", ");
}

function createConceptStoreUrl(conceptId: string | null | undefined) {
  return conceptId
    ? `https://store.playstation.com/concept/${encodeURIComponent(conceptId)}`
    : null;
}

function createProviderGameIds(values: {
  conceptId?: string | null;
  entitlementId?: string | null;
  npCommunicationId?: string | null;
  productId?: string | null;
  titleId?: string | null;
}) {
  return [
    values.titleId ? `titleId:${values.titleId}` : null,
    values.productId ? `productId:${values.productId}` : null,
    values.conceptId ? `conceptId:${values.conceptId}` : null,
    values.entitlementId ? `entitlementId:${values.entitlementId}` : null,
    values.npCommunicationId
      ? `npCommunicationId:${values.npCommunicationId}`
      : null,
  ].filter((value): value is string => Boolean(value));
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

function getSyncedGameProviderGameIds(game: SyncedLibraryGame) {
  return uniqueValues([game.providerGameId, ...(game.providerGameIds ?? [])]);
}

function mapTitleToSyncedGame(title: TrophyTitle): SyncedLibraryGame {
  const providerGameIds = createProviderGameIds({
    npCommunicationId: title.npCommunicationId,
  });

  return {
    providerGameId: providerGameIds[0] ?? `npCommunicationId:${title.npCommunicationId}`,
    providerGameIds,
    title: title.trophyTitleName,
    platformName: formatPlayStationPlatform(title.trophyTitlePlatform),
    completionPercent:
      typeof title.progress === "number"
        ? Math.max(0, Math.min(100, Math.round(title.progress)))
        : null,
    rawData: {
      syncSource: "trophy-title",
      npServiceName: title.npServiceName,
      npCommunicationId: title.npCommunicationId,
      trophySetVersion: title.trophySetVersion,
      trophyTitleIconUrl: title.trophyTitleIconUrl,
      trophyTitlePlatform: title.trophyTitlePlatform,
      hasTrophyGroups: title.hasTrophyGroups,
      definedTrophies: title.definedTrophies,
      earnedTrophies: title.earnedTrophies,
      progress: title.progress,
      hiddenFlag: title.hiddenFlag,
      lastUpdatedDateTime: title.lastUpdatedDateTime,
      lastTrophyUpdatedAt: parsePlayStationDate(title.lastUpdatedDateTime)
        ?.toISOString() ?? null,
      trophyTitleDetail: title.trophyTitleDetail ?? null,
    },
  };
}

function mapPurchasedGameToSyncedGame(game: PurchasedGame): SyncedLibraryGame {
  const providerGameIds = createProviderGameIds({
    conceptId: game.conceptId,
    entitlementId: game.entitlementId,
    productId: game.productId,
    titleId: game.titleId,
  });

  return {
    providerGameId:
      providerGameIds[0] ??
      `productId:${game.productId}`,
    providerGameIds,
    title: game.name,
    platformName: game.platform
      ? normalizePlayStationPlatformName(game.platform)
      : "PlayStation",
    storeUrl: createConceptStoreUrl(game.conceptId),
    rawData: {
      syncSource: "purchased-game",
      conceptId: game.conceptId,
      entitlementId: game.entitlementId,
      imageUrl: game.image?.url ?? null,
      isActive: game.isActive,
      isDownloadable: game.isDownloadable,
      isPreOrder: game.isPreOrder,
      membership: game.membership,
      platform: game.platform,
      productId: game.productId,
      titleId: game.titleId,
    },
  };
}

type PlayStationPlayedGame = Awaited<
  ReturnType<typeof getUserPlayedGames>
>["titles"][number];

function mapPlayedGameToSyncedGame(game: PlayStationPlayedGame): SyncedLibraryGame {
  const conceptId = game.concept?.id ? String(game.concept.id) : null;
  const providerGameIds = createProviderGameIds({
    conceptId,
    titleId: game.titleId,
  });
  const playtimeMinutes = parsePlayStationDurationMinutes(game.playDuration);

  return {
    providerGameId: providerGameIds[0] ?? `titleId:${game.titleId}`,
    providerGameIds,
    title: game.localizedName || game.name,
    platformName: getPlayStationPlayedPlatformName(game.category),
    playtimeMinutes,
    lastPlayedAt: parsePlayStationDate(game.lastPlayedDateTime),
    storeUrl: createConceptStoreUrl(conceptId),
    rawData: {
      syncSource: "played-game",
      category: game.category,
      concept: game.concept,
      firstPlayedDateTime: game.firstPlayedDateTime,
      imageUrl: game.localizedImageUrl || game.imageUrl || null,
      lastPlayedDateTime: game.lastPlayedDateTime,
      media: game.media,
      playCount: game.playCount,
      playDuration: game.playDuration,
      service: game.service,
      titleId: game.titleId,
    },
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

function mergePlayStationSyncedGames(
  purchasedGames: SyncedLibraryGame[],
  trophyGames: SyncedLibraryGame[],
  playedGames: SyncedLibraryGame[],
) {
  const mergedGames = new Map<string, SyncedLibraryGame>();

  for (const game of [...purchasedGames, ...trophyGames, ...playedGames]) {
    const titleKey = normalizeTitle(game.title);
    const providerIds = getSyncedGameProviderGameIds(game);
    const existing =
      providerIds
        .map((providerId) => mergedGames.get(`provider:${providerId}`))
        .find(Boolean) ?? mergedGames.get(`title:${titleKey}`);

    if (!existing) {
      const nextGame = {
        ...game,
        providerGameIds: providerIds,
        rawData: {
          playStationSyncSources: [game.rawData],
        },
      };
      mergedGames.set(`title:${titleKey}`, nextGame);
      for (const providerId of providerIds) {
        mergedGames.set(`provider:${providerId}`, nextGame);
      }
      continue;
    }

    const existingProviderIds = getSyncedGameProviderGameIds(existing);
    const nextProviderIds = uniqueValues([...existingProviderIds, ...providerIds]);
    existing.providerGameIds = nextProviderIds;
    existing.providerGameId =
      existingProviderIds.find((providerId) => providerId.startsWith("titleId:")) ??
      providerIds.find((providerId) => providerId.startsWith("titleId:")) ??
      existing.providerGameId;
    existing.platformName = uniqueValues([
      existing.platformName,
      game.platformName,
    ]).join(", ");
    existing.storeUrl = existing.storeUrl ?? game.storeUrl ?? null;
    existing.completionPercent =
      existing.completionPercent ?? game.completionPercent ?? null;
    existing.playtimeMinutes =
      game.playtimeMinutes !== undefined
        ? game.playtimeMinutes
        : existing.playtimeMinutes;
    existing.lastPlayedAt =
      game.lastPlayedAt && existing.lastPlayedAt
        ? new Date(
            Math.max(game.lastPlayedAt.getTime(), existing.lastPlayedAt.getTime()),
          )
        : game.lastPlayedAt ?? existing.lastPlayedAt ?? null;
    existing.rawData = {
      playStationSyncSources: [
        ...(
          Array.isArray(existing.rawData?.playStationSyncSources)
            ? existing.rawData.playStationSyncSources
            : [existing.rawData]
        ).filter(Boolean),
        game.rawData,
      ],
    };

    for (const providerId of nextProviderIds) {
      mergedGames.set(`provider:${providerId}`, existing);
    }
  }

  return Array.from(
    new Set(
      Array.from(mergedGames.entries())
        .filter(([key]) => key.startsWith("title:"))
        .map(([, game]) => game),
    ),
  );
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
      lastSyncedAt: new Date(),
    },
  });

  return {
    games,
    profile: profileResult.profile,
  };
}

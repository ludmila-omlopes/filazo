import crypto from "node:crypto";
import { ExternalProvider, type ExternalAccount, type Prisma } from "@prisma/client";
import { getAuthSecret } from "@/lib/auth-secret";
import { prisma } from "@/lib/prisma";
import type { ProviderProfile, SyncedLibraryGame } from "@/lib/providers/contracts";

const XBOX_OAUTH_SCOPES = ["Xboxlive.signin", "Xboxlive.offline_access"];
const MICROSOFT_AUTH_URL = "https://login.live.com/oauth20_authorize.srf";
const MICROSOFT_TOKEN_URL = "https://login.live.com/oauth20_token.srf";
const XBOX_USER_AUTH_URL = "https://user.auth.xboxlive.com/user/authenticate";
const XBOX_XSTS_AUTH_URL = "https://xsts.auth.xboxlive.com/xsts/authorize";
const XBOX_PROFILE_URL = "https://profile.xboxlive.com";
const XBOX_ACHIEVEMENTS_URL = "https://achievements.xboxlive.com";
const XBOX_TITLEHUB_URL = "https://titlehub.xboxlive.com";
const XBOX_TITLEHUB_MAX_ITEMS = 200;

type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  tag: string;
};

type XboxOAuthToken = {
  tokenType?: string;
  expiresAt?: string;
  accessToken?: EncryptedSecret;
  refreshToken?: EncryptedSecret;
  scope?: string;
  userId?: string;
};

type XboxTokenResponse = {
  token_type: string;
  expires_in: number;
  scope: string;
  access_token: string;
  refresh_token?: string;
  user_id?: string;
};

type XboxTokenDisplayClaim = {
  xid?: string;
  uhs?: string;
  gtg?: string;
  agg?: string;
  prv?: string;
  usr?: string;
};

type XboxServiceTokenResponse = {
  IssueInstant: string;
  NotAfter: string;
  Token: string;
  DisplayClaims?: {
    xui?: XboxTokenDisplayClaim[];
  };
};

type XboxAccountMetadata = {
  auth?: XboxOAuthToken;
  profile?: ProviderProfile;
  connectedAt?: string;
  lastTokenRefreshAt?: string;
  syncMode?: "achievement-title-history";
  titleHistoryLimit?: number;
};

type XboxTitleHistoryItem = {
  titleId?: number | string;
  name?: string;
  platform?: string;
  titleType?: string;
  serviceConfigId?: string;
  lastUnlock?: string;
  earnedAchievements?: number;
  currentGamerscore?: number;
  maxGamerscore?: number;
};

type XboxTitleHubItem = {
  titleId?: string;
  pfn?: string;
  serviceConfigId?: string;
  name?: string;
  displayImage?: string;
  devices?: string[];
  achievement?: {
    currentAchievements?: number;
    totalAchievements?: number;
    currentGamerscore?: number;
    totalGamerscore?: number;
    progressPercentage?: number;
  };
  titleHistory?: {
    lastTimePlayed?: string;
  };
  images?: Array<{
    type?: string;
    url?: string;
  }>;
};

type XboxAuthorization = {
  authorizationHeader: string;
  xuid: string;
  gamertag?: string | null;
};

export function isXboxConfigured() {
  return Boolean(process.env.XBOX_CLIENT_ID);
}

function getXboxClientId() {
  const clientId = process.env.XBOX_CLIENT_ID;
  if (!clientId) {
    throw new Error("Set XBOX_CLIENT_ID before connecting Xbox.");
  }

  return clientId;
}

function getXboxClientSecret() {
  return process.env.XBOX_CLIENT_SECRET || "";
}

function getXboxRedirectUri(origin: string) {
  return `${origin}/api/auth/xbox/callback`;
}

export function createXboxAuthUrl(origin: string, state?: string) {
  const url = new URL(MICROSOFT_AUTH_URL);
  url.searchParams.set("client_id", getXboxClientId());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", XBOX_OAUTH_SCOPES.join(" "));
  url.searchParams.set("redirect_uri", getXboxRedirectUri(origin));

  if (state) {
    url.searchParams.set("state", state);
  }

  return url.toString();
}

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

function parseXboxMetadata(value: Prisma.JsonValue | null): XboxAccountMetadata {
  if (!isRecord(value)) {
    return {};
  }

  const auth = isRecord(value.auth) ? value.auth : {};

  return {
    auth: {
      accessToken: isEncryptedSecret(auth.accessToken)
        ? auth.accessToken
        : undefined,
      refreshToken: isEncryptedSecret(auth.refreshToken)
        ? auth.refreshToken
        : undefined,
      expiresAt:
        typeof auth.expiresAt === "string" ? auth.expiresAt : undefined,
      scope: typeof auth.scope === "string" ? auth.scope : undefined,
      tokenType:
        typeof auth.tokenType === "string" ? auth.tokenType : undefined,
      userId: typeof auth.userId === "string" ? auth.userId : undefined,
    },
    profile: isRecord(value.profile)
      ? (value.profile as XboxAccountMetadata["profile"])
      : undefined,
    connectedAt:
      typeof value.connectedAt === "string" ? value.connectedAt : undefined,
    lastTokenRefreshAt:
      typeof value.lastTokenRefreshAt === "string"
        ? value.lastTokenRefreshAt
        : undefined,
    syncMode:
      value.syncMode === "achievement-title-history"
        ? value.syncMode
        : undefined,
    titleHistoryLimit:
      typeof value.titleHistoryLimit === "number"
        ? value.titleHistoryLimit
        : undefined,
  };
}

function isFutureDate(value: string | undefined, skewMs = 60_000) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now() + skewMs;
}

function createOAuthMetadata(
  token: XboxTokenResponse,
  fallbackRefreshToken?: EncryptedSecret,
  now = new Date(),
): XboxOAuthToken {
  return {
    accessToken: encryptSecret(token.access_token),
    expiresAt: new Date(now.getTime() + token.expires_in * 1000).toISOString(),
    refreshToken: token.refresh_token
      ? encryptSecret(token.refresh_token)
      : fallbackRefreshToken,
    scope: token.scope,
    tokenType: token.token_type,
    userId: token.user_id,
  };
}

async function requestJson<T>(
  url: string,
  init: RequestInit & { errorMessage: string },
): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${init.errorMessage} (${response.status}): ${body}`);
  }

  return response.json() as Promise<T>;
}

async function requestOAuthToken({
  code,
  origin,
}: {
  code: string;
  origin: string;
}) {
  const formData = new URLSearchParams({
    client_id: getXboxClientId(),
    code,
    grant_type: "authorization_code",
    redirect_uri: getXboxRedirectUri(origin),
    scope: XBOX_OAUTH_SCOPES.join(" "),
  });
  const clientSecret = getXboxClientSecret();
  if (clientSecret) {
    formData.set("client_secret", clientSecret);
  }

  return requestJson<XboxTokenResponse>(MICROSOFT_TOKEN_URL, {
    method: "POST",
    body: formData,
    errorMessage: "Could not exchange Microsoft authorization code",
  });
}

async function refreshOAuthToken(metadata: XboxAccountMetadata) {
  const refreshToken = metadata.auth?.refreshToken;
  if (!refreshToken) {
    throw new Error("Xbox token expired. Connect Xbox again.");
  }

  const formData = new URLSearchParams({
    client_id: getXboxClientId(),
    grant_type: "refresh_token",
    refresh_token: decryptSecret(refreshToken),
    scope: XBOX_OAUTH_SCOPES.join(" "),
  });
  const clientSecret = getXboxClientSecret();
  if (clientSecret) {
    formData.set("client_secret", clientSecret);
  }

  const token = await requestJson<XboxTokenResponse>(MICROSOFT_TOKEN_URL, {
    method: "POST",
    body: formData,
    errorMessage: "Could not refresh Xbox OAuth token",
  });

  return {
    metadata: {
      ...metadata,
      auth: createOAuthMetadata(token, refreshToken),
      lastTokenRefreshAt: new Date().toISOString(),
    } satisfies XboxAccountMetadata,
    accessToken: token.access_token,
  };
}

async function requestXboxUserToken(accessToken: string) {
  return requestJson<XboxServiceTokenResponse>(XBOX_USER_AUTH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-xbl-contract-version": "1",
    },
    body: JSON.stringify({
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT",
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: `d=${accessToken}`,
      },
    }),
    errorMessage: "Could not authenticate with Xbox Live",
  });
}

async function requestXstsToken(userToken: string) {
  return requestJson<XboxServiceTokenResponse>(XBOX_XSTS_AUTH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-xbl-contract-version": "1",
    },
    body: JSON.stringify({
      RelyingParty: "http://xboxlive.com",
      TokenType: "JWT",
      Properties: {
        SandboxId: "RETAIL",
        UserTokens: [userToken],
      },
    }),
    errorMessage:
      "Could not authorize Xbox Live token. Child accounts may be blocked by Xbox Live",
  });
}

async function createXboxAuthorization(accessToken: string): Promise<XboxAuthorization> {
  const userToken = await requestXboxUserToken(accessToken);
  const xstsToken = await requestXstsToken(userToken.Token);
  const claim = xstsToken.DisplayClaims?.xui?.[0] ?? {};

  if (!claim.xid || !claim.uhs) {
    throw new Error("Xbox Live did not return an XUID for this account.");
  }

  return {
    authorizationHeader: `XBL3.0 x=${claim.uhs};${xstsToken.Token}`,
    gamertag: claim.gtg ?? null,
    xuid: claim.xid,
  };
}

async function getAuthorizationForAccount(account: ExternalAccount) {
  const metadata = parseXboxMetadata(account.metadata);
  let accessToken = metadata.auth?.accessToken
    ? decryptSecret(metadata.auth.accessToken)
    : null;
  let nextMetadata = metadata;

  if (!accessToken || !isFutureDate(metadata.auth?.expiresAt)) {
    const refreshed = await refreshOAuthToken(metadata);
    accessToken = refreshed.accessToken;
    nextMetadata = refreshed.metadata;

    await prisma.externalAccount.update({
      where: { id: account.id },
      data: {
        metadata: nextMetadata as Prisma.InputJsonValue,
      },
    });
  }

  const authorization = await createXboxAuthorization(accessToken);

  return {
    authorization,
    metadata: nextMetadata,
  };
}

function findProfileSetting(
  profileUser: Record<string, unknown>,
  id: string,
) {
  const settings = Array.isArray(profileUser.settings)
    ? profileUser.settings
    : [];
  const setting = settings.find(
    (item): item is Record<string, unknown> =>
      isRecord(item) && item.id === id,
  );

  return typeof setting?.value === "string" ? setting.value : null;
}

async function fetchXboxProfile(authorization: XboxAuthorization) {
  const settings = [
    "Gamertag",
    "ModernGamertag",
    "UniqueModernGamertag",
    "GameDisplayPicRaw",
    "Gamerscore",
    "AccountTier",
  ].join(",");
  const url = new URL(
    `${XBOX_PROFILE_URL}/users/xuid(${authorization.xuid})/profile/settings`,
  );
  url.searchParams.set("settings", settings);

  const response = await requestJson<{ profileUsers?: Array<Record<string, unknown>> }>(
    url.toString(),
    {
      method: "GET",
      headers: {
        Authorization: authorization.authorizationHeader,
        "x-xbl-contract-version": "3",
      },
      errorMessage: "Could not fetch Xbox profile",
    },
  );
  const profileUser = response.profileUsers?.[0] ?? {};
  const gamertag =
    findProfileSetting(profileUser, "UniqueModernGamertag") ??
    findProfileSetting(profileUser, "ModernGamertag") ??
    findProfileSetting(profileUser, "Gamertag") ??
    authorization.gamertag ??
    `Xbox ${authorization.xuid.slice(-4)}`;

  return {
    providerAccountId: authorization.xuid,
    username: findProfileSetting(profileUser, "Gamertag") ?? gamertag,
    displayName: gamertag,
    avatarUrl: findProfileSetting(profileUser, "GameDisplayPicRaw"),
    profileUrl: `https://www.xbox.com/play/user/${encodeURIComponent(gamertag)}`,
    metadata: {
      accountTier: findProfileSetting(profileUser, "AccountTier"),
      gamerscore: findProfileSetting(profileUser, "Gamerscore"),
    },
  } satisfies ProviderProfile;
}

function parseXboxDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function calculateCompletionPercent(input: {
  earnedAchievements?: number | null;
  totalAchievements?: number | null;
  currentGamerscore?: number | null;
  maxGamerscore?: number | null;
  progressPercentage?: number | null;
}) {
  if (typeof input.progressPercentage === "number") {
    return Math.max(0, Math.min(100, Math.round(input.progressPercentage)));
  }

  if (
    typeof input.earnedAchievements === "number" &&
    typeof input.totalAchievements === "number" &&
    input.totalAchievements > 0
  ) {
    return Math.max(
      0,
      Math.min(100, Math.round((input.earnedAchievements / input.totalAchievements) * 100)),
    );
  }

  if (
    typeof input.currentGamerscore === "number" &&
    typeof input.maxGamerscore === "number" &&
    input.maxGamerscore > 0
  ) {
    return Math.max(
      0,
      Math.min(100, Math.round((input.currentGamerscore / input.maxGamerscore) * 100)),
    );
  }

  return null;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

function mapPlatform(value: unknown) {
  if (typeof value !== "string" || !value) {
    return "Xbox";
  }

  if (value.toLowerCase().includes("windows")) {
    return "Xbox / Windows";
  }

  return value;
}

function pickTitleHubImage(title: XboxTitleHubItem) {
  return (
    title.displayImage ??
    title.images?.find((image) => image.type === "BoxArt")?.url ??
    title.images?.find((image) => image.url)?.url ??
    null
  );
}

async function fetchAchievementTitleHistory(authorization: XboxAuthorization) {
  const response = await requestJson<{ titles?: XboxTitleHistoryItem[] }>(
    `${XBOX_ACHIEVEMENTS_URL}/users/xuid(${authorization.xuid})/history/titles`,
    {
      method: "GET",
      headers: {
        Authorization: authorization.authorizationHeader,
        "x-xbl-contract-version": "2",
      },
      errorMessage: "Could not fetch Xbox achievement title history",
    },
  );

  return response.titles ?? [];
}

async function fetchTitleHubHistory(authorization: XboxAuthorization) {
  const fields = [
    "achievement",
    "image",
    "scid",
    "detail",
    "alternateTitleId",
    "productId",
  ].join(",");
  const url = new URL(
    `${XBOX_TITLEHUB_URL}/users/xuid(${authorization.xuid})/titles/titlehistory/decoration/${fields}`,
  );
  url.searchParams.set("maxItems", String(XBOX_TITLEHUB_MAX_ITEMS));

  const response = await requestJson<{ titles?: XboxTitleHubItem[] }>(
    url.toString(),
    {
      method: "GET",
      headers: {
        Authorization: authorization.authorizationHeader,
        "Accept-Language": "en-US",
        "x-xbl-client-name": "XboxApp",
        "x-xbl-client-type": "UWA",
        "x-xbl-client-version": "39.39.22001.0",
        "x-xbl-contract-version": "2",
      },
      errorMessage: "Could not fetch Xbox title history",
    },
  );

  return response.titles ?? [];
}

function mergeXboxTitles(
  achievementTitles: XboxTitleHistoryItem[],
  titleHubTitles: XboxTitleHubItem[],
): SyncedLibraryGame[] {
  const merged = new Map<string, SyncedLibraryGame>();

  for (const title of titleHubTitles) {
    const titleId = title.titleId ? String(title.titleId) : null;
    if (!titleId || !title.name) {
      continue;
    }

    const providerGameIds = uniqueValues([
      `titleId:${titleId}`,
      title.serviceConfigId ? `scid:${title.serviceConfigId}` : null,
      title.pfn ? `pfn:${title.pfn}` : null,
    ]);

    merged.set(titleId, {
      providerGameId: providerGameIds[0] ?? `titleId:${titleId}`,
      providerGameIds,
      title: title.name,
      platformName: title.devices?.length ? title.devices.join(", ") : "Xbox",
      completionPercent: calculateCompletionPercent({
        currentGamerscore: title.achievement?.currentGamerscore ?? null,
        earnedAchievements: title.achievement?.currentAchievements ?? null,
        maxGamerscore: title.achievement?.totalGamerscore ?? null,
        progressPercentage: title.achievement?.progressPercentage ?? null,
        totalAchievements: title.achievement?.totalAchievements ?? null,
      }),
      lastPlayedAt: parseXboxDate(title.titleHistory?.lastTimePlayed),
      rawData: {
        syncSource: "xbox-titlehub-history",
        coverUrl: pickTitleHubImage(title),
        title,
      },
    });
  }

  for (const title of achievementTitles) {
    const titleId = title.titleId ? String(title.titleId) : null;
    if (!titleId || !title.name) {
      continue;
    }

    const existing = merged.get(titleId);
    const providerGameIds = uniqueValues([
      existing?.providerGameId,
      ...(existing?.providerGameIds ?? []),
      `titleId:${titleId}`,
      title.serviceConfigId ? `scid:${title.serviceConfigId}` : null,
    ]);
    const completionPercent = calculateCompletionPercent({
      currentGamerscore: title.currentGamerscore ?? null,
      earnedAchievements: title.earnedAchievements ?? null,
      maxGamerscore: title.maxGamerscore ?? null,
    });

    merged.set(titleId, {
      providerGameId: providerGameIds[0] ?? `titleId:${titleId}`,
      providerGameIds,
      title: existing?.title ?? title.name,
      platformName: existing?.platformName ?? mapPlatform(title.platform),
      completionPercent: existing?.completionPercent ?? completionPercent,
      lastPlayedAt:
        existing?.lastPlayedAt ?? parseXboxDate(title.lastUnlock),
      rawData: {
        syncSource: "xbox-achievement-title-history",
        achievementTitle: title,
        titleHubTitle: existing?.rawData,
      },
    });
  }

  return Array.from(merged.values());
}

export async function connectXboxAccountForUser({
  userId,
  code,
  origin,
}: {
  userId: string;
  code: string;
  origin: string;
}) {
  const token = await requestOAuthToken({ code, origin });
  const authorization = await createXboxAuthorization(token.access_token);
  const profile = await fetchXboxProfile(authorization);
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!existingUser) {
    throw new Error("Sign in before connecting Xbox.");
  }

  const metadata: XboxAccountMetadata = {
    auth: createOAuthMetadata(token),
    connectedAt: new Date().toISOString(),
    profile,
    syncMode: "achievement-title-history",
    titleHistoryLimit: XBOX_TITLEHUB_MAX_ITEMS,
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
        provider: ExternalProvider.XBOX,
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
      provider: ExternalProvider.XBOX,
      providerAccountId: profile.providerAccountId,
      username: profile.username ?? undefined,
      displayName: profile.displayName ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
      profileUrl: profile.profileUrl ?? undefined,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

export async function syncXboxLibraryForAccount(account: ExternalAccount) {
  const { authorization, metadata } = await getAuthorizationForAccount(account);
  const [profile, achievementTitles, titleHubTitles] = await Promise.all([
    fetchXboxProfile(authorization),
    fetchAchievementTitleHistory(authorization),
    fetchTitleHubHistory(authorization).catch(() => []),
  ]);
  const games = mergeXboxTitles(achievementTitles, titleHubTitles);
  const nextMetadata: XboxAccountMetadata = {
    ...metadata,
    profile,
    syncMode: "achievement-title-history",
    titleHistoryLimit: XBOX_TITLEHUB_MAX_ITEMS,
  };

  await prisma.externalAccount.update({
    where: { id: account.id },
    data: {
      username: profile.username ?? undefined,
      displayName: profile.displayName ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
      profileUrl: profile.profileUrl ?? undefined,
      metadata: nextMetadata as Prisma.InputJsonValue,
      lastSyncedAt: new Date(),
    },
  });

  return {
    games,
    profile,
  };
}

export async function fetchXboxAchievementProgressForTitle(
  account: ExternalAccount,
  providerGameIds: string[],
) {
  const { authorization } = await getAuthorizationForAccount(account);
  const [achievementTitles, titleHubTitles] = await Promise.all([
    fetchAchievementTitleHistory(authorization),
    fetchTitleHubHistory(authorization).catch(() => []),
  ]);
  const games = mergeXboxTitles(achievementTitles, titleHubTitles);
  const providerGameIdSet = new Set(providerGameIds);
  const game = games.find((candidate) =>
    [candidate.providerGameId, ...(candidate.providerGameIds ?? [])].some(
      (providerGameId) => providerGameIdSet.has(providerGameId),
    ),
  );

  if (!game) {
    return null;
  }

  return {
    completionPercent: game.completionPercent,
    lastPlayedAt: game.lastPlayedAt,
    rawData: game.rawData,
  };
}

import { randomBytes } from "node:crypto";
import {
  ExternalProvider,
  type ExternalAccount,
  type Prisma,
} from "@prisma/client";
import { jwtVerify, SignJWT } from "jose";
import { getAuthSecret } from "./auth-secret.ts";
import { prisma } from "./prisma.ts";
import type {
  ProviderProfile,
  SyncedLibraryGame,
} from "./providers/contracts.ts";

const GOG_BASE_URL = "https://www.gog.com";
const GOG_PROFILE_CHALLENGE_AUDIENCE = "gog-profile-verification";
const GOG_PROFILE_CHALLENGE_ISSUER = "filazo";
const GOG_PROFILE_CHALLENGE_SECONDS = 15 * 60;
const GOG_REQUEST_TIMEOUT_MS = 15_000;
const GOG_USERNAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const GOG_VERIFICATION_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export const GOG_PROFILE_CHALLENGE_COOKIE =
  "filazo-gog-profile-challenge";

export type GogVerificationChallenge = {
  code: string;
  expiresAt: Date;
  username: string;
};

export type GogProfileErrorCode =
  | "ACCOUNT_IN_USE"
  | "CHALLENGE_INVALID"
  | "CODE_NOT_FOUND"
  | "GAMES_PRIVATE"
  | "PROFILE_INVALID"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_PRIVATE";

type GogAccountMetadata = {
  connectedAt?: string;
  profile?: ProviderProfile;
  syncMode?: "public-profile";
  verificationMethod?: "profile-bio";
  verifiedAt?: string;
};

type GogPublicProfileUser = Record<string, unknown> & {
  avatar?: string;
  avatars?: Record<string, unknown>;
  created_date?: string;
  stats?: Record<string, unknown>;
  userId?: string | number;
  username?: string;
};

type GogPublicProfilePreferences = Record<string, unknown> & {
  bio?: string;
  privacy?: Record<string, unknown>;
};

type GogPublicGame = Record<string, unknown> & {
  achievementSupport?: boolean;
  id?: string | number;
  image?: string;
  title?: string;
  url?: string;
};

type GogPublicGameItem = Record<string, unknown> & {
  game?: GogPublicGame;
  stats?: Record<string, unknown> | unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createGogError(
  message: string,
  platformSyncErrorCode:
    | "AUTH"
    | "NETWORK"
    | "PROVIDER"
    | "RATE_LIMIT"
    | "TIMEOUT",
  gogProfileErrorCode?: GogProfileErrorCode,
) {
  return Object.assign(new Error(message), {
    gogProfileErrorCode,
    platformSyncErrorCode,
  });
}

export function getGogProfileErrorCode(error: unknown) {
  if (!isRecord(error)) return null;
  const code = error.gogProfileErrorCode;
  const supportedCodes: GogProfileErrorCode[] = [
    "ACCOUNT_IN_USE",
    "CHALLENGE_INVALID",
    "CODE_NOT_FOUND",
    "GAMES_PRIVATE",
    "PROFILE_INVALID",
    "PROFILE_NOT_FOUND",
    "PROFILE_PRIVATE",
  ];
  return supportedCodes.includes(code as GogProfileErrorCode)
    ? (code as GogProfileErrorCode)
    : null;
}

function getChallengeSecret() {
  return new TextEncoder().encode(getAuthSecret());
}

function createVerificationCode() {
  const random = randomBytes(8);
  let suffix = "";
  for (let index = 0; index < 8; index += 1) {
    suffix += GOG_VERIFICATION_ALPHABET[
      random[index] % GOG_VERIFICATION_ALPHABET.length
    ];
  }
  return `FLZ-${suffix}`;
}

export function normalizeGogUsername(value: string) {
  let username = value.trim();
  if (!username) {
    throw createGogError(
      "Enter your current GOG username.",
      "AUTH",
      "PROFILE_INVALID",
    );
  }

  if (/^https?:\/\//i.test(username)) {
    let url: URL;
    try {
      url = new URL(username);
    } catch {
      throw createGogError(
        "Enter a valid GOG username or profile URL.",
        "AUTH",
        "PROFILE_INVALID",
      );
    }
    if (
      url.protocol !== "https:" ||
      !["gog.com", "www.gog.com"].includes(url.hostname.toLowerCase())
    ) {
      throw createGogError(
        "The profile URL must belong to gog.com.",
        "AUTH",
        "PROFILE_INVALID",
      );
    }
    const match = url.pathname.match(/^\/(?:[a-z]{2}\/)?u\/([^/]+)\/?$/i);
    if (!match) {
      throw createGogError(
        "Enter a GOG profile URL such as https://www.gog.com/u/username.",
        "AUTH",
        "PROFILE_INVALID",
      );
    }
    try {
      username = decodeURIComponent(match[1]);
    } catch {
      throw createGogError(
        "The GOG profile URL contains an invalid username.",
        "AUTH",
        "PROFILE_INVALID",
      );
    }
  }

  username = username.replace(/^@/, "").trim();
  if (!GOG_USERNAME_PATTERN.test(username)) {
    throw createGogError(
      "Enter a valid GOG username using letters, numbers, dots, dashes, or underscores.",
      "AUTH",
      "PROFILE_INVALID",
    );
  }
  return username;
}

export async function createGogVerificationChallenge({
  now = new Date(),
  userId,
  username,
}: {
  now?: Date;
  userId: string;
  username: string;
}) {
  const normalizedUsername = normalizeGogUsername(username);
  const code = createVerificationCode();
  const expiresAt = new Date(
    now.getTime() + GOG_PROFILE_CHALLENGE_SECONDS * 1000,
  );
  const token = await new SignJWT({ code, username: normalizedUsername })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(GOG_PROFILE_CHALLENGE_AUDIENCE)
    .setIssuer(GOG_PROFILE_CHALLENGE_ISSUER)
    .setSubject(userId)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getChallengeSecret());

  return {
    challenge: { code, expiresAt, username: normalizedUsername },
    maxAge: GOG_PROFILE_CHALLENGE_SECONDS,
    token,
  };
}

export async function readGogVerificationChallenge({
  now = new Date(),
  token,
  userId,
}: {
  now?: Date;
  token: string | null | undefined;
  userId: string;
}): Promise<GogVerificationChallenge | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getChallengeSecret(), {
      audience: GOG_PROFILE_CHALLENGE_AUDIENCE,
      currentDate: now,
      issuer: GOG_PROFILE_CHALLENGE_ISSUER,
      subject: userId,
    });
    const code = typeof payload.code === "string" ? payload.code : "";
    const username =
      typeof payload.username === "string" ? payload.username : "";
    if (!/^FLZ-[2-9A-HJ-NP-Z]{8}$/.test(code)) return null;
    const normalizedUsername = normalizeGogUsername(username);
    if (typeof payload.exp !== "number") return null;
    return {
      code,
      expiresAt: new Date(payload.exp * 1000),
      username: normalizedUsername,
    };
  } catch {
    return null;
  }
}

function getRequestSignal(signal?: AbortSignal) {
  return signal ?? AbortSignal.timeout(GOG_REQUEST_TIMEOUT_MS);
}

async function requestGog(
  url: URL | string,
  options: {
    accept: string;
    errorMessage: string;
    signal?: AbortSignal;
  },
) {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: options.accept,
        "User-Agent":
          "filazo/1.0 (+https://github.com/ludmila-omlopes/filazo)",
      },
      signal: getRequestSignal(options.signal),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      throw createGogError(`${options.errorMessage}: request timed out.`, "TIMEOUT");
    }
    throw createGogError(
      `${options.errorMessage}: network request failed.`,
      "NETWORK",
    );
  }

  if (!response.ok) {
    const profileCode =
      response.status === 404 ? "PROFILE_NOT_FOUND" : undefined;
    const error = createGogError(
      `${options.errorMessage} (${response.status}).`,
      response.status === 429
        ? "RATE_LIMIT"
        : response.status === 401 ||
            response.status === 403 ||
            response.status === 404
          ? "AUTH"
          : "PROVIDER",
      profileCode,
    );
    // Let the durable queue honor provider-requested retry windows.
    throw Object.assign(error, { response: { headers: response.headers } });
  }
  return response;
}

function extractAssignedJson(html: string, property: string) {
  const marker = `window.profilesData.${property}`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const assignmentIndex = html.indexOf("=", markerIndex + marker.length);
  if (assignmentIndex < 0) return null;
  let start = assignmentIndex + 1;
  while (/\s/.test(html[start] ?? "")) start += 1;
  if (html.startsWith("null", start)) return null;
  if (html[start] !== "{" && html[start] !== "[") return null;

  const opening = html[start];
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let escaped = false;
  let inString = false;
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === opening) depth += 1;
    if (character === closing) depth -= 1;
    if (depth === 0) {
      try {
        return JSON.parse(html.slice(start, index + 1)) as unknown;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function parseGogProfileDocument(html: string) {
  const user = extractAssignedJson(html, "profileUser");
  const preferences = extractAssignedJson(html, "profileUserPreferences");
  if (!isRecord(user)) {
    throw createGogError(
      "GOG did not return a public profile.",
      "AUTH",
      "PROFILE_PRIVATE",
    );
  }
  if (!isRecord(preferences)) {
    throw createGogError(
      "Make your GOG profile public before verifying it.",
      "AUTH",
      "PROFILE_PRIVATE",
    );
  }

  return {
    preferences: preferences as GogPublicProfilePreferences,
    user: user as GogPublicProfileUser,
  };
}

function getGogProfilePrivacy(preferences: GogPublicProfilePreferences) {
  const privacy = isRecord(preferences.privacy) ? preferences.privacy : {};
  return {
    games: typeof privacy.games === "string" ? privacy.games : null,
    profile: typeof privacy.profile === "string" ? privacy.profile : null,
  };
}

function getAvatarUrl(value: GogPublicProfileUser) {
  const avatars = isRecord(value.avatars) ? value.avatars : {};
  const candidate =
    avatars.medium_2x ?? avatars.medium2x ?? avatars.medium ?? value.avatar;
  return typeof candidate === "string" ? candidate : null;
}

function mapPublicProfileToProviderProfile(
  user: GogPublicProfileUser,
): ProviderProfile {
  const accountId = user.userId;
  const username =
    typeof user.username === "string" ? user.username.trim() : "";
  if (
    (typeof accountId !== "string" && typeof accountId !== "number") ||
    !String(accountId).trim() ||
    !username
  ) {
    throw createGogError(
      "GOG returned an invalid public profile.",
      "PROVIDER",
      "PROFILE_INVALID",
    );
  }
  const stats = isRecord(user.stats) ? user.stats : {};
  return {
    providerAccountId: String(accountId),
    username,
    displayName: username,
    avatarUrl: getAvatarUrl(user),
    profileUrl: `${GOG_BASE_URL}/u/${encodeURIComponent(username)}`,
    metadata: {
      gamesOwned: stats.games_owned ?? undefined,
      userSince:
        typeof user.created_date === "string" ? user.created_date : undefined,
    },
  };
}

async function fetchGogPublicProfile(
  username: string,
  signal?: AbortSignal,
) {
  const normalizedUsername = normalizeGogUsername(username);
  const response = await requestGog(
    `${GOG_BASE_URL}/u/${encodeURIComponent(normalizedUsername)}`,
    {
      accept: "text/html,application/xhtml+xml",
      errorMessage: "Could not load the GOG public profile",
      signal,
    },
  );
  const { preferences, user } = parseGogProfileDocument(
    await response.text(),
  );
  const privacy = getGogProfilePrivacy(preferences);
  if (privacy.profile !== "public") {
    throw createGogError(
      "Make your GOG profile public before connecting it.",
      "AUTH",
      "PROFILE_PRIVATE",
    );
  }
  return {
    bio: typeof preferences.bio === "string" ? preferences.bio : "",
    privacy,
    profile: mapPublicProfileToProviderProfile(user),
  };
}

async function fetchCurrentGogUsername(
  providerAccountId: string,
  signal?: AbortSignal,
) {
  const response = await requestGog(
    `${GOG_BASE_URL}/users/${encodeURIComponent(providerAccountId)}/info`,
    {
      accept: "application/json",
      errorMessage: "Could not resolve the current GOG username",
      signal,
    },
  );
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw createGogError("GOG returned invalid public user data.", "PROVIDER");
  }
  const username =
    isRecord(value) && typeof value.username === "string"
      ? value.username.trim()
      : "";
  const galaxyUserId = isRecord(value)
    ? value.galaxyUserId ?? value.id
    : null;
  if (!username || String(galaxyUserId ?? "") !== providerAccountId) {
    throw createGogError("GOG returned a mismatched public account.", "AUTH");
  }
  return username;
}

export async function connectGogPublicProfileForUser({
  code,
  userId,
  username,
}: {
  code: string;
  userId: string;
  username: string;
}) {
  const publicProfile = await fetchGogPublicProfile(username);
  if (publicProfile.privacy.games !== "public") {
    throw createGogError(
      "Make your GOG game library public before connecting it.",
      "AUTH",
      "GAMES_PRIVATE",
    );
  }
  if (!publicProfile.bio.includes(code)) {
    throw createGogError(
      "The verification code is not visible in the GOG profile bio yet.",
      "AUTH",
      "CODE_NOT_FOUND",
    );
  }

  const profile = publicProfile.profile;
  const now = new Date();
  const metadata: GogAccountMetadata = {
    connectedAt: now.toISOString(),
    profile,
    syncMode: "public-profile",
    verificationMethod: "profile-bio",
    verifiedAt: now.toISOString(),
  };

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`gog-account:${profile.providerAccountId}`}, 0))`;
    const [user, connectedAccount] = await Promise.all([
      transaction.user.findUnique({ where: { id: userId } }),
      transaction.externalAccount.findUnique({
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
      throw createGogError(
        "This GOG profile is already connected to another user.",
        "AUTH",
        "ACCOUNT_IN_USE",
      );
    }

    await transaction.user.update({
      where: { id: userId },
      data: {
        displayName: user.displayName ?? profile.displayName ?? undefined,
        avatarUrl: user.avatarUrl ?? profile.avatarUrl ?? undefined,
      },
    });

    return transaction.externalAccount.upsert({
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
        lastSyncErrorCode: null,
        nextSyncAt: now,
        syncFailureCount: 0,
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
        nextSyncAt: now,
      },
    });
  });
}

function normalizeGogImageUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.startsWith("//")) return `https:${value}`;
  return value.startsWith("https://") ? value : null;
}

function parseOptionalDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function mapGogPublicGameToSyncedGame(
  item: GogPublicGameItem,
  providerAccountId: string,
): SyncedLibraryGame | null {
  const game = isRecord(item.game) ? (item.game as GogPublicGame) : null;
  const providerGameId =
    typeof game?.id === "number" || typeof game?.id === "string"
      ? String(game.id).trim()
      : "";
  const title = typeof game?.title === "string" ? game.title.trim() : "";
  if (!game || !providerGameId || !title) return null;

  const relativeUrl =
    typeof game.url === "string" && game.url.startsWith("/")
      ? game.url
      : null;
  const stats =
    isRecord(item.stats) && isRecord(item.stats[providerAccountId])
      ? item.stats[providerAccountId]
      : {};
  const playtime =
    typeof stats.playtime === "number" ? stats.playtime : Number.NaN;
  const achievementsPercentage =
    typeof stats.achievementsPercentage === "number"
      ? stats.achievementsPercentage
      : Number.NaN;
  const image = normalizeGogImageUrl(game.image);

  return {
    providerGameId,
    title,
    platformName: "GOG",
    playtimeMinutes:
      Number.isFinite(playtime) && playtime >= 0 ? Math.round(playtime) : null,
    lastPlayedAt: parseOptionalDate(stats.lastSession),
    completionPercent:
      Number.isFinite(achievementsPercentage) &&
      achievementsPercentage >= 0 &&
      achievementsPercentage <= 100
        ? Math.round(achievementsPercentage)
        : null,
    storeUrl: relativeUrl
      ? new URL(relativeUrl, GOG_BASE_URL).toString()
      : null,
    rawData: {
      achievementSupport: game.achievementSupport === true,
      image,
      images: { background: null, logo: image, logo2x: image },
      source: "public-profile",
    },
  };
}

// Fetch exactly one page; the durable queue owns pagination and checkpoints.
export async function fetchGogLibraryPage(
  account: ExternalAccount,
  page: number,
  signal: AbortSignal,
) {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw createGogError("Invalid GOG page number.", "PROVIDER");
  }
  const username = await fetchCurrentGogUsername(account.providerAccountId, signal);
  const publicProfile = await fetchGogPublicProfile(username, signal);
  if (publicProfile.profile.providerAccountId !== account.providerAccountId) {
    throw createGogError("The public GOG profile no longer matches this account.", "AUTH");
  }
  if (publicProfile.privacy.games !== "public") {
    throw createGogError("Make your GOG game library public before synchronizing it.", "AUTH", "GAMES_PRIVATE");
  }
  const url = new URL(`/u/${encodeURIComponent(username)}/games/stats`, GOG_BASE_URL);
  url.searchParams.set("sort", "alphabetically");
  url.searchParams.set("order", "asc");
  url.searchParams.set("page", String(page));
  const response = await requestGog(url, {
    accept: "application/hal+json,application/json",
    errorMessage: "Could not load the public GOG library",
    signal,
  });
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw createGogError("GOG returned invalid public library data.", "PROVIDER");
  }
  const parsed = parseGogLibraryPage(value, page, account.providerAccountId);
  return { ...parsed, profile: publicProfile.profile };
}

export function parseGogLibraryPage(value: unknown, page: number, providerAccountId: string) {
  if (!isRecord(value) || !isRecord(value._embedded) || !Array.isArray(value._embedded.items)) {
    throw createGogError("GOG did not return a readable public library.", "PROVIDER");
  }
  const pages = value.pages;
  const total = value.total;
  if (value.page !== page || typeof pages !== "number" || !Number.isSafeInteger(pages) ||
      pages < 0 || typeof total !== "number" || !Number.isSafeInteger(total) || total < 0 ||
      (pages > 0 && page > pages) || (pages === 0 && (page !== 1 || total !== 0))) {
    throw createGogError("GOG returned invalid library pagination.", "PROVIDER");
  }
  const games: SyncedLibraryGame[] = [];
  for (const candidate of value._embedded.items) {
    const game = isRecord(candidate) ? mapGogPublicGameToSyncedGame(candidate, providerAccountId) : null;
    // Never advance a durable checkpoint past data we could not import.
    if (!game) throw createGogError("GOG returned an invalid library game.", "PROVIDER");
    games.push(game);
  }
  if ((!games.length && total > 0) || (games.length > 0 && total === 0)) {
    throw createGogError("GOG returned an incomplete library page.", "PROVIDER");
  }
  return { games, nextPage: page < pages ? page + 1 : null, totalCount: total };
}

export function getGogArtworkFallback(
  rawData: Record<string, unknown> | undefined,
) {
  if (!rawData) return null;
  const images = isRecord(rawData.images) ? rawData.images : {};
  const coverUrl =
    normalizeGogImageUrl(images.logo2x) ??
    normalizeGogImageUrl(images.logo) ??
    normalizeGogImageUrl(rawData.image);
  const heroUrl = normalizeGogImageUrl(images.background);
  return coverUrl || heroUrl ? { coverUrl, heroUrl } : null;
}

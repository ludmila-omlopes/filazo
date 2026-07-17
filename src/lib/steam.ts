import { ExternalProvider, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserProfileSyncData } from "@/lib/user-profile-sync";
import {
  mapSteamOwnedGames,
  type SteamOwnedGame,
} from "@/lib/steam-library";
import { uniqueSlug } from "@/lib/utils";
import type {
  ProviderAccountAdapter,
  ProviderProfile,
  SyncedLibraryGame,
} from "@/lib/providers/contracts";

export {
  createSteamAuthUrl,
  verifySteamOpenIdCallback,
} from "@/lib/steam-openid";

type SteamPlayerSummaryResponse = {
  response?: {
    players?: Array<{
      steamid: string;
      personaname?: string;
      profileurl?: string;
      avatarfull?: string;
      avatarhash?: string;
      personastate?: number;
    }>;
  };
};

type SteamOwnedGamesResponse = {
  response?: {
    games?: SteamOwnedGame[];
  };
};

type SteamPlayerAchievementsResponse = {
  playerstats?: {
    success?: boolean;
    achievements?: Array<{
      apiname: string;
      achieved: number;
    }>;
  };
};

export type SteamAchievementCompletion = {
  completionPercent: number | null;
  unlockedAchievements: number;
  totalAchievements: number;
  reason: "available" | "no-achievements" | "unavailable";
};

function getSteamApiKey() {
  return process.env.STEAM_API_KEY;
}

function createSteamApiError(message: string, response: Response) {
  const error = new Error(`${message} (${response.status}).`) as Error & {
    retryAfter?: string;
  };
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) error.retryAfter = retryAfter;
  return error;
}

export function isSteamConfigured() {
  return Boolean(getSteamApiKey());
}

async function fetchSteamPlayerSummary(
  steamId: string,
  options: { signal?: AbortSignal } = {},
): Promise<ProviderProfile> {
  const apiKey = getSteamApiKey();
  if (!apiKey) {
    return {
      providerAccountId: steamId,
      displayName: createSteamPlaceholderUserName(steamId),
      profileUrl: `https://steamcommunity.com/profiles/${steamId}`,
      metadata: {
        configured: false,
      },
    };
  }

  const url = new URL(
    "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/",
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamids", steamId);

  const response = await fetch(url, {
    cache: "no-store",
    signal: options.signal,
  });

  if (!response.ok) {
    throw createSteamApiError("Could not fetch Steam profile", response);
  }

  const data = (await response.json()) as SteamPlayerSummaryResponse;
  const player = data.response?.players?.[0];

  return {
    providerAccountId: steamId,
    displayName: player?.personaname ?? `Steam ${steamId}`,
    username: player?.personaname ?? null,
    avatarUrl: player?.avatarfull ?? null,
    profileUrl:
      player?.profileurl ?? `https://steamcommunity.com/profiles/${steamId}`,
    metadata: {
      avatarHash: player?.avatarhash ?? null,
      personaState: player?.personastate ?? null,
    },
  };
}

async function fetchSteamOwnedGames(
  steamId: string,
  options: { signal?: AbortSignal } = {},
): Promise<SyncedLibraryGame[]> {
  const apiKey = getSteamApiKey();
  if (!apiKey) {
    throw new Error(
      "STEAM_API_KEY is required to sync owned games from Steam.",
    );
  }

  const url = new URL(
    "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/",
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamid", steamId);
  url.searchParams.set("include_appinfo", "1");
  url.searchParams.set("include_played_free_games", "1");

  const response = await fetch(url, {
    cache: "no-store",
    signal: options.signal,
  });

  if (!response.ok) {
    throw createSteamApiError("Could not fetch owned games from Steam", response);
  }

  const data = (await response.json()) as SteamOwnedGamesResponse;
  return mapSteamOwnedGames(data.response?.games ?? []);
}

export async function fetchSteamAchievementCompletion(
  steamId: string,
  appId: number,
  options: { signal?: AbortSignal } = {},
): Promise<SteamAchievementCompletion> {
  const apiKey = getSteamApiKey();
  if (!apiKey) {
    return createUnavailableAchievementCompletion();
  }

  const url = new URL(
    "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/",
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamid", steamId);
  url.searchParams.set("appid", String(appId));

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: options.signal,
    });

    if (!response.ok) {
      return createUnavailableAchievementCompletion();
    }

    const data = (await response.json()) as SteamPlayerAchievementsResponse;
    const achievements = data.playerstats?.achievements ?? [];
    if (!data.playerstats?.success || achievements.length === 0) {
      return {
        completionPercent: null,
        unlockedAchievements: 0,
        totalAchievements: 0,
        reason: "no-achievements",
      };
    }

    const unlockedAchievements = achievements.filter(
      (achievement) => achievement.achieved === 1,
    ).length;
    const completionPercent = Math.round(
      (unlockedAchievements / achievements.length) * 100,
    );

    return {
      completionPercent,
      unlockedAchievements,
      totalAchievements: achievements.length,
      reason: "available",
    };
  } catch (error) {
    if (options.signal?.aborted) {
      throw error;
    }
    return createUnavailableAchievementCompletion();
  }
}

function createUnavailableAchievementCompletion(): SteamAchievementCompletion {
  return {
    completionPercent: null,
    unlockedAchievements: 0,
    totalAchievements: 0,
    reason: "unavailable",
  };
}

export const steamAdapter: ProviderAccountAdapter = {
  provider: "STEAM",
  fetchProfile: fetchSteamPlayerSummary,
  syncOwnedLibrary: fetchSteamOwnedGames,
};

export async function upsertSteamAccountForUser({
  userId,
  steamId,
}: {
  userId: string;
  steamId: string;
}) {
  const profile = await steamAdapter.fetchProfile(steamId);

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, avatarUrl: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: getUserProfileSyncData(existingUser, profile),
  });

  return prisma.externalAccount.upsert({
    where: {
      provider_providerAccountId: {
        provider: ExternalProvider.STEAM,
        providerAccountId: steamId,
      },
    },
    update: {
      userId,
      username: profile.username ?? undefined,
      displayName: profile.displayName ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
      profileUrl: profile.profileUrl ?? undefined,
      metadata: profile.metadata as Prisma.InputJsonValue | undefined,
    },
    create: {
      userId,
      provider: ExternalProvider.STEAM,
      providerAccountId: steamId,
      username: profile.username ?? undefined,
      displayName: profile.displayName ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
      profileUrl: profile.profileUrl ?? undefined,
      metadata: profile.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export function createSteamPlaceholderUserName(steamId: string) {
  return `Player ${steamId.slice(-4)}`;
}

export function createSteamFallbackSlug(title: string, appId: string) {
  return uniqueSlug(title, appId);
}

export function getSteamStoreArtwork(appId: string) {
  const assetBase = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}`;

  return {
    // The profile grid expects portrait box art, so use Steam's library cover first.
    coverUrl: `${assetBase}/library_600x900_2x.jpg`,
    heroUrl: `${assetBase}/library_hero.jpg`,
  };
}

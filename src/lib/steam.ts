import { ExternalProvider, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/utils";
import type {
  ProviderAccountAdapter,
  ProviderProfile,
  SyncedLibraryGame,
} from "@/lib/providers/contracts";

const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";

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
    games?: Array<{
      appid: number;
      name?: string;
      playtime_forever?: number;
      img_icon_url?: string;
      img_logo_url?: string;
      rtime_last_played?: number;
    }>;
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

export function createSteamAuthUrl(origin: string) {
  const url = new URL(STEAM_OPENID_ENDPOINT);
  url.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");
  url.searchParams.set("openid.mode", "checkid_setup");
  url.searchParams.set(
    "openid.return_to",
    `${origin}/api/auth/steam/callback`,
  );
  url.searchParams.set("openid.realm", origin);
  url.searchParams.set(
    "openid.identity",
    "http://specs.openid.net/auth/2.0/identifier_select",
  );
  url.searchParams.set(
    "openid.claimed_id",
    "http://specs.openid.net/auth/2.0/identifier_select",
  );
  return url.toString();
}

export async function verifySteamOpenIdCallback(
  searchParams: URLSearchParams,
) {
  const params = new URLSearchParams();
  searchParams.forEach((value, key) => {
    params.set(key, value);
  });
  params.set("openid.mode", "check_authentication");

  const response = await fetch(STEAM_OPENID_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  const text = await response.text();
  if (!text.includes("is_valid:true")) {
    throw new Error("Steam OpenID verification did not complete.");
  }

  const claimedId = searchParams.get("openid.claimed_id");
  const steamId =
    claimedId?.match(/\/id\/(\d+)$/)?.[1] ??
    claimedId?.match(/\/openid\/id\/(\d+)$/)?.[1];

  if (!steamId) {
    throw new Error("Steam OpenID callback did not include a valid Steam ID.");
  }

  return steamId;
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
  const games = (data.response?.games ?? []).filter((game) => game.name);
  const achievementCompletions = await fetchSteamAchievementCompletions(
    steamId,
    games.map((game) => game.appid),
    options,
  );

  return games.map((game) => {
    const achievementCompletion = achievementCompletions.get(game.appid) ?? {
      completionPercent: null,
      unlockedAchievements: 0,
      totalAchievements: 0,
      reason: "unavailable" as const,
    };

    return {
      providerGameId: String(game.appid),
      title: game.name ?? `Steam App ${game.appid}`,
      platformName: "Steam",
      playtimeMinutes: game.playtime_forever ?? 0,
      lastPlayedAt: parseSteamLastPlayedAt(game.rtime_last_played),
      completionPercent: achievementCompletion.completionPercent,
      storeUrl: `https://store.steampowered.com/app/${game.appid}`,
      rawData: {
        appid: game.appid,
        iconUrl: game.img_icon_url ?? null,
        logoUrl: game.img_logo_url ?? null,
        rtimeLastPlayed: game.rtime_last_played ?? null,
        achievementCompletion,
      },
    };
  });
}

function parseSteamLastPlayedAt(value: number | undefined) {
  if (!value || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value * 1000);
}

async function fetchSteamAchievementCompletions(
  steamId: string,
  appIds: number[],
  options: { signal?: AbortSignal } = {},
) {
  const completions = new Map<number, SteamAchievementCompletion>();
  const concurrency = 6;

  for (let index = 0; index < appIds.length; index += concurrency) {
    if (options.signal?.aborted) {
      throw new Error("Steam synchronization was aborted.");
    }
    const batch = appIds.slice(index, index + concurrency);
    const results = await Promise.all(
      batch.map(async (appId) => [
        appId,
        await fetchSteamAchievementCompletion(steamId, appId, options),
      ] as const),
    );

    for (const [appId, completion] of results) {
      completions.set(appId, completion);
    }
  }

  return completions;
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

  await prisma.user.update({
    where: { id: userId },
    data: {
      displayName: profile.displayName ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
    },
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

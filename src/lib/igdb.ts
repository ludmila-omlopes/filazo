import type {
  CatalogMetadataAdapter,
  EnrichedGameMetadata,
} from "@/lib/providers/contracts";
import { normalizeTitle } from "@/lib/utils";

type IgdbGameRecord = {
  id: number;
  name: string;
  slug?: string | null;
  summary?: string | null;
  first_release_date?: number | null;
  aggregated_rating?: number | null;
  aggregated_rating_count?: number | null;
  genres?: Array<{ name: string }>;
  platforms?: Array<{ name: string }>;
  cover?: { url?: string | null };
  screenshots?: Array<{ url?: string | null }>;
  artworks?: Array<{ url?: string | null }>;
  websites?: Array<{ url?: string | null }>;
};

let cachedToken:
  | {
      value: string;
      expiresAt: number;
    }
  | undefined;

function isIgdbConfigured() {
  return Boolean(process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET);
}

async function getIgdbToken() {
  if (!isIgdbConfigured()) {
    return null;
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.IGDB_CLIENT_ID!,
      client_secret: process.env.IGDB_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Could not authenticate with IGDB.");
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    value: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return cachedToken.value;
}

function formatIgdbAsset(url?: string | null, size = "t_cover_big") {
  if (!url) {
    return null;
  }

  const normalized = url.startsWith("//") ? `https:${url}` : url;
  return normalized.replace("t_thumb", size);
}

function scoreCandidate(
  queryTitle: string,
  candidate: IgdbGameRecord,
  platformName?: string | null,
) {
  const normalizedQuery = normalizeTitle(queryTitle);
  const normalizedCandidate = normalizeTitle(candidate.name);

  let score = 0;

  if (normalizedCandidate === normalizedQuery) {
    score += 100;
  } else if (normalizedCandidate.startsWith(normalizedQuery)) {
    score += 70;
  } else if (normalizedCandidate.includes(normalizedQuery)) {
    score += 50;
  }

  score -= Math.min(
    Math.abs(normalizedCandidate.length - normalizedQuery.length),
    30,
  );

  if (platformName) {
    const normalizedPlatform = normalizeTitle(platformName);
    const platformMatch = candidate.platforms?.some((platform) =>
      normalizeTitle(platform.name).includes(normalizedPlatform),
    );
    if (platformMatch) {
      score += 25;
    }
  }

  return score;
}

function mapIgdbGame(game: IgdbGameRecord): EnrichedGameMetadata {
  return {
    igdbId: game.id,
    slug: game.slug ?? null,
    name: game.name,
    summary: game.summary ?? null,
    coverUrl: formatIgdbAsset(game.cover?.url),
    heroUrl:
      formatIgdbAsset(game.artworks?.[0]?.url, "t_1080p") ??
      formatIgdbAsset(game.screenshots?.[0]?.url, "t_1080p"),
    releaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000)
      : null,
    aggregatedRating: game.aggregated_rating ?? null,
    totalRatingCount: game.aggregated_rating_count ?? null,
    genres: game.genres?.map((genre) => genre.name) ?? [],
    platforms: game.platforms?.map((platform) => platform.name) ?? [],
    screenshots:
      game.screenshots
        ?.map((screenshot) => formatIgdbAsset(screenshot.url, "t_1080p"))
        .filter((screenshot): screenshot is string => Boolean(screenshot)) ?? [],
    websites:
      game.websites?.map((website) => website.url ?? "").filter((screenshot): screenshot is string => Boolean(screenshot)) ?? [],
  };
}

async function queryIgdbGames(query: string, limit: number) {
  const token = await getIgdbToken();
  if (!token || !process.env.IGDB_CLIENT_ID) {
    return [];
  }

  const body = [
    "fields name,slug,summary,first_release_date,aggregated_rating,aggregated_rating_count,cover.url,genres.name,platforms.name,screenshots.url,artworks.url,websites.url;",
    `search "${query.replace(/"/g, '\\"')}";`,
    `limit ${limit};`,
    "where version_parent = null;",
  ].join(" ");

  const response = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": process.env.IGDB_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Could not query IGDB.");
  }

  return (await response.json()) as IgdbGameRecord[];
}

async function fetchIgdbGameById(igdbId: number) {
  const token = await getIgdbToken();
  if (!token || !process.env.IGDB_CLIENT_ID) {
    return null;
  }

  const body = [
    "fields name,slug,summary,first_release_date,aggregated_rating,aggregated_rating_count,cover.url,genres.name,platforms.name,screenshots.url,artworks.url,websites.url;",
    `where id = ${igdbId};`,
    "limit 1;",
  ].join(" ");

  const response = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": process.env.IGDB_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Could not query IGDB.");
  }

  const results = (await response.json()) as IgdbGameRecord[];
  return results[0] ? mapIgdbGame(results[0]) : null;
}

export const igdbAdapter: CatalogMetadataAdapter = {
  provider: "IGDB",
  async searchBestMatch({ title, platformName }) {
    const results = await queryIgdbGames(title, 10);
    if (!results.length) {
      return null;
    }

    const ranked = [...results]
      .map((game) => ({
        game,
        score: scoreCandidate(title, game, platformName),
      }))
      .sort((left, right) => right.score - left.score);

    if (!ranked[0] || ranked[0].score < 35) {
      return null;
    }

    return mapIgdbGame(ranked[0].game);
  },
};

export async function searchIgdbGames(query: string, limit = 8) {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    return [];
  }

  const results = await queryIgdbGames(trimmedQuery, limit);
  return results.map(mapIgdbGame);
}

export async function getIgdbGameById(igdbId: number) {
  return fetchIgdbGameById(igdbId);
}

export function hasIgdbConfig() {
  return isIgdbConfigured();
}

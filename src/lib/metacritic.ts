import type {
  CatalogReviewScoreAdapter,
  EnrichedReviewScore,
} from "@/lib/providers/contracts";
import { normalizeTitle } from "@/lib/utils";

const STEAM_APPDETAILS_URL = "https://store.steampowered.com/api/appdetails";
const STEAM_STORE_SEARCH_URL = "https://store.steampowered.com/api/storesearch";
const SEARCH_TIMEOUT_MS = 8_000;

type SteamMetacritic = {
  score?: number | null;
  url?: string | null;
};

type SteamAppDetailsResponse = Record<
  string,
  {
    success?: boolean;
    data?: {
      metacritic?: SteamMetacritic | null;
    } | null;
  }
>;

type SteamStoreSearchResult = {
  type?: string | null;
  name?: string | null;
  id?: number | string | null;
  metascore?: string | number | null;
};

type SteamStoreSearchResponse = {
  items?: SteamStoreSearchResult[];
};

function cleanMetacriticUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}

function parseMetascore(value: string | number | null | undefined) {
  const score = typeof value === "string" ? Number(value) : value;
  if (
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > 100
  ) {
    return null;
  }

  return score;
}

function mapSteamMetacritic(
  appId: string,
  metacritic: SteamMetacritic | null | undefined,
): EnrichedReviewScore | null {
  const score = parseMetascore(metacritic?.score);
  if (score === null) {
    return null;
  }

  const url = cleanMetacriticUrl(metacritic?.url);

  return {
    providerGameId: url ?? `steam-app-${appId}`,
    score,
    url,
    sourceProvider: "STEAM",
    rawData: {
      steamAppId: appId,
      metacritic,
    },
  };
}

function scoreSteamSearchCandidate(title: string, candidate: SteamStoreSearchResult) {
  if (candidate.type !== "app" || !candidate.name || !candidate.id) {
    return 0;
  }

  const query = normalizeTitle(title);
  const name = normalizeTitle(candidate.name);
  if (!query || !name) {
    return 0;
  }

  if (name === query) {
    return 100;
  }

  if (name.startsWith(query)) {
    return 75;
  }

  if (name.includes(query)) {
    return 60;
  }

  const queryTokens = new Set(query.split(" "));
  const nameTokens = new Set(name.split(" "));
  const overlap = [...queryTokens].filter((token) => nameTokens.has(token)).length;
  return (2 * overlap * 50) / (queryTokens.size + nameTokens.size);
}

async function fetchSteamMetacritic(appId: string, signal: AbortSignal) {
  const url = new URL(STEAM_APPDETAILS_URL);
  url.searchParams.set("appids", appId);
  url.searchParams.set("filters", "metacritic");

  const response = await fetch(url, {
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as SteamAppDetailsResponse;
  return mapSteamMetacritic(appId, data[appId]?.data?.metacritic);
}

async function searchSteamAppId(title: string, signal: AbortSignal) {
  const url = new URL(STEAM_STORE_SEARCH_URL);
  url.searchParams.set("term", title);
  url.searchParams.set("cc", "us");
  url.searchParams.set("l", "en");

  const response = await fetch(url, {
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as SteamStoreSearchResponse;
  const ranked = (data.items ?? [])
    .map((item) => ({
      item,
      score: scoreSteamSearchCandidate(title, item),
    }))
    .sort((left, right) => right.score - left.score);

  const bestMatch = ranked[0];
  if (!bestMatch || bestMatch.score < 70 || !bestMatch.item.id) {
    return null;
  }

  return String(bestMatch.item.id);
}

export const metacriticAdapter: CatalogReviewScoreAdapter = {
  provider: "METACRITIC",
  async searchBestMatch({ title, steamAppId }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    try {
      if (steamAppId) {
        const score = await fetchSteamMetacritic(steamAppId, controller.signal);
        if (score) {
          return score;
        }
      }

      const appId = await searchSteamAppId(title, controller.signal);
      return appId ? await fetchSteamMetacritic(appId, controller.signal) : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  },
};

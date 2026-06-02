import type {
  CatalogCompletionTimeAdapter,
  EnrichedCompletionTimes,
} from "@/lib/providers/contracts";
import { normalizeTitle } from "@/lib/utils";

const HLTB_BASE_URL = "https://howlongtobeat.com";
const HLTB_FALLBACK_SEARCH_PATH = "/api/s";
const SEARCH_TIMEOUT_MS = 8_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

type HltbAuth = {
  token: string;
  key: string;
  value: string;
};

type HltbSearchResult = {
  game_id?: number | string;
  game_name?: string | null;
  game_alias?: string | null;
  game_image?: string | null;
  profile_platform?: string | null;
  comp_main?: number | null;
  comp_plus?: number | null;
  comp_100?: number | null;
};

type HltbSearchResponse = {
  data?: HltbSearchResult[];
};

function createHeaders(auth?: HltbAuth) {
  return {
    accept: "*/*",
    "content-type": "application/json",
    Origin: HLTB_BASE_URL,
    Referer: `${HLTB_BASE_URL}/`,
    "User-Agent": USER_AGENT,
    ...(auth
      ? {
          "x-auth-token": auth.token,
          "x-hp-key": auth.key,
          "x-hp-val": auth.value,
        }
      : {}),
  };
}

function getSearchPayload(title: string, auth?: HltbAuth) {
  return {
    searchType: "games",
    searchTerms: title.split(/\s+/).filter(Boolean),
    searchPage: 1,
    size: 20,
    searchOptions: {
      games: {
        userId: 0,
        platform: "",
        sortCategory: "popular",
        rangeCategory: "main",
        rangeTime: {
          min: 0,
          max: 0,
        },
        gameplay: {
          perspective: "",
          flow: "",
          genre: "",
          difficulty: "",
        },
        rangeYear: {
          max: "",
          min: "",
        },
        modifier: "hide_dlc",
      },
      users: {
        sortCategory: "postcount",
      },
      lists: {
        sortCategory: "follows",
      },
      filter: "",
      sort: 0,
      randomizer: 0,
    },
    useCache: true,
    ...(auth ? { [auth.key]: auth.value } : {}),
  };
}

function resolveScriptUrl(src: string) {
  if (src.startsWith("http")) {
    return src;
  }

  return `${HLTB_BASE_URL}${src.startsWith("/") ? src : `/${src}`}`;
}

async function fetchText(url: string, signal: AbortSignal) {
  const response = await fetch(url, {
    headers: {
      Referer: `${HLTB_BASE_URL}/`,
      "User-Agent": USER_AGENT,
    },
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return response.text();
}

function extractScriptUrls(html: string, appOnly: boolean) {
  const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(
    (match) => match[1],
  );

  return appOnly
    ? scripts.filter((src) => src.includes("_app-"))
    : scripts;
}

function extractSearchPath(script: string) {
  const match = script.match(
    /fetch\s*\(\s*["'](\/api\/[a-zA-Z0-9_/]+)[^"']*["']\s*,\s*{[\s\S]*?method:\s*["']POST["']/i,
  );

  if (!match?.[1]) {
    return null;
  }

  const [apiRoot, endpoint] = match[1].split("/").filter(Boolean);
  return apiRoot && endpoint ? `/${apiRoot}/${endpoint}` : null;
}

async function discoverSearchPath(signal: AbortSignal) {
  const html = await fetchText(`${HLTB_BASE_URL}/`, signal);
  if (!html) {
    return HLTB_FALLBACK_SEARCH_PATH;
  }

  for (const appOnly of [true, false]) {
    for (const src of extractScriptUrls(html, appOnly)) {
      const script = await fetchText(resolveScriptUrl(src), signal);
      const searchPath = script ? extractSearchPath(script) : null;
      if (searchPath) {
        return searchPath;
      }
    }
  }

  return HLTB_FALLBACK_SEARCH_PATH;
}

async function fetchAuth(searchPath: string, signal: AbortSignal) {
  const url = new URL(`${HLTB_BASE_URL}${searchPath}/init`);
  url.searchParams.set("t", String(Date.now()));

  const response = await fetch(url, {
    headers: {
      Referer: `${HLTB_BASE_URL}/`,
      "User-Agent": USER_AGENT,
    },
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as Record<string, unknown>;
  const token = typeof data.token === "string" ? data.token : null;
  const keyEntry = Object.entries(data).find(([key]) => /key/i.test(key));
  const valueEntry = Object.entries(data).find(([key]) => /val/i.test(key));

  if (!token || !keyEntry || !valueEntry) {
    return null;
  }

  return {
    token,
    key: String(keyEntry[1]),
    value: String(valueEntry[1]),
  };
}

function secondsToMinutes(value: number | null | undefined) {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value / 60);
}

function similarity(left: string, right: string) {
  const a = normalizeTitle(left);
  const b = normalizeTitle(right);
  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  const aTokens = new Set(a.split(" "));
  const bTokens = new Set(b.split(" "));
  const overlap = [...aTokens].filter((token) => bTokens.has(token)).length;
  return (2 * overlap) / (aTokens.size + bTokens.size);
}

function scoreCandidate(
  queryTitle: string,
  candidate: HltbSearchResult,
  platformName?: string | null,
) {
  const nameScore = Math.max(
    similarity(queryTitle, candidate.game_name ?? ""),
    similarity(queryTitle, candidate.game_alias ?? ""),
  );
  let score = nameScore * 100;

  if (platformName && candidate.profile_platform) {
    const normalizedPlatform = normalizeTitle(platformName);
    const platformMatch = candidate.profile_platform
      .split(",")
      .some((platform) => normalizeTitle(platform).includes(normalizedPlatform));
    if (platformMatch) {
      score += 15;
    }
  }

  return score;
}

function mapHltbEntry(
  entry: HltbSearchResult,
  queryTitle: string,
): EnrichedCompletionTimes | null {
  const hltbId = entry.game_id ? String(entry.game_id) : null;
  const name = entry.game_name?.trim();
  if (!hltbId || !name) {
    return null;
  }

  const mainStoryMinutes = secondsToMinutes(entry.comp_main);
  const mainExtraMinutes = secondsToMinutes(entry.comp_plus);
  const completionistMinutes = secondsToMinutes(entry.comp_100);

  if (!mainStoryMinutes && !mainExtraMinutes && !completionistMinutes) {
    return null;
  }

  const platforms = entry.profile_platform
    ? entry.profile_platform.split(",").map((platform) => platform.trim())
    : [];

  return {
    hltbId,
    name,
    mainStoryMinutes,
    mainExtraMinutes,
    completionistMinutes,
    platforms,
    similarity: similarity(queryTitle, name),
    storeUrl: `${HLTB_BASE_URL}/game/${hltbId}`,
    rawData: {
      ...entry,
      platforms,
    },
  };
}

async function searchHltb(title: string, signal: AbortSignal) {
  const searchPath = await discoverSearchPath(signal);
  const auth = await fetchAuth(searchPath, signal);
  const response = await fetch(`${HLTB_BASE_URL}${searchPath}`, {
    method: "POST",
    headers: createHeaders(auth ?? undefined),
    body: JSON.stringify(getSearchPayload(title, auth ?? undefined)),
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as HltbSearchResponse;
  return data.data ?? [];
}

export const hltbAdapter: CatalogCompletionTimeAdapter = {
  provider: "HLTB",
  async searchBestMatch({ title, platformName }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    try {
      const results = await searchHltb(title, controller.signal);
      const ranked = results
        .map((entry) => ({
          entry,
          score: scoreCandidate(title, entry, platformName),
        }))
        .sort((left, right) => right.score - left.score);

      const bestMatch = ranked[0];
      if (!bestMatch || bestMatch.score < 55) {
        return null;
      }

      return mapHltbEntry(bestMatch.entry, title);
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  },
};

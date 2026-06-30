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
  url?: string | null;
  genres?: Array<{ name: string }>;
  platforms?: Array<{ name: string }>;
  cover?: { url?: string | null };
  screenshots?: Array<{ url?: string | null }>;
  artworks?: Array<{ url?: string | null }>;
  websites?: Array<{ url?: string | null }>;
};

type IgdbNamedReference =
  | number
  | {
      id: number;
      name?: string | null;
    };

type IgdbReleaseGameRecord = IgdbGameRecord & {
  game_type?: number | { type?: string | null } | null;
  parent_game?: IgdbNamedReference | null;
  version_parent?: IgdbNamedReference | null;
  franchise?: IgdbNamedReference | null;
  franchises?: IgdbNamedReference[];
  collections?: IgdbNamedReference[];
  dlcs?: IgdbNamedReference[];
  expanded_games?: IgdbNamedReference[];
  expansions?: IgdbNamedReference[];
  remakes?: IgdbNamedReference[];
  remasters?: IgdbNamedReference[];
  standalone_expansions?: IgdbNamedReference[];
};

export type UpcomingReleaseRelationType =
  | "dlc"
  | "expansion"
  | "standalone_expansion"
  | "expanded_game"
  | "remake"
  | "remaster"
  | "sequel_or_related";

export type IgdbUpcomingRelease = {
  provider: "IGDB";
  providerGameId: string;
  igdbId: number;
  title: string;
  slug: string | null;
  summary: string | null;
  releaseDate: string;
  relationType: UpcomingReleaseRelationType;
  gameType: string | null;
  parentGameIgdbId: number | null;
  url: string | null;
  franchiseNames: string[];
  collectionNames: string[];
};

export type IgdbUpcomingReleaseLookup = {
  source: "IGDB";
  sourceGame: {
    igdbId: number;
    name: string;
    slug: string | null;
    url: string | null;
  };
  relationKeys: {
    franchiseNames: string[];
    collectionNames: string[];
  };
  releases: IgdbUpcomingRelease[];
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

function readReferenceId(value: IgdbNamedReference | null | undefined) {
  if (!value) {
    return null;
  }

  return typeof value === "number" ? value : value.id;
}

function readReferenceIds(values: IgdbNamedReference[] | null | undefined) {
  return [
    ...new Set(
      (values ?? [])
        .map(readReferenceId)
        .filter((value): value is number => value !== null),
    ),
  ];
}

function readReferenceNames(values: IgdbNamedReference[] | null | undefined) {
  return [
    ...new Set(
      (values ?? [])
        .map((value) =>
          typeof value === "object" && value.name ? value.name.trim() : "",
        )
        .filter(Boolean),
    ),
  ];
}

function readGameType(value: IgdbReleaseGameRecord["game_type"]) {
  if (!value || typeof value === "number") {
    return null;
  }

  return value.type?.trim() || null;
}

function toIsoDateFromUnix(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

async function queryIgdbReleaseGames(body: string) {
  const token = await getIgdbToken();
  if (!token || !process.env.IGDB_CLIENT_ID) {
    return [];
  }

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
    throw new Error("Could not query IGDB release data.");
  }

  return (await response.json()) as IgdbReleaseGameRecord[];
}

function releaseGameFields() {
  return [
    "id",
    "name",
    "slug",
    "summary",
    "first_release_date",
    "url",
    "game_type.type",
    "parent_game",
    "version_parent",
    "franchise.name",
    "franchises.name",
    "collections.name",
  ].join(",");
}

async function fetchIgdbReleaseSeed(igdbId: number) {
  const body = [
    "fields id,name,slug,first_release_date,url,game_type.type,franchise.name,franchises.name,collections.name,dlcs,expanded_games,expansions,remakes,remasters,standalone_expansions;",
    `where id = ${igdbId};`,
    "limit 1;",
  ].join(" ");

  const results = await queryIgdbReleaseGames(body);
  return results[0] ?? null;
}

async function fetchIgdbReleaseGamesByIds(ids: number[]) {
  const uniqueIds = [...new Set(ids)].slice(0, 50);
  if (!uniqueIds.length) {
    return [];
  }

  const body = [
    `fields ${releaseGameFields()};`,
    `where id = (${uniqueIds.join(",")});`,
    "limit 50;",
  ].join(" ");

  return queryIgdbReleaseGames(body);
}

async function fetchUpcomingIgdbReleaseGamesByReference({
  field,
  ids,
  maxReleaseDate,
  minReleaseDate,
  sourceIgdbId,
}: {
  field: "collections" | "franchises";
  ids: number[];
  maxReleaseDate: number;
  minReleaseDate: number;
  sourceIgdbId: number;
}) {
  const uniqueIds = [...new Set(ids)].slice(0, 8);
  if (!uniqueIds.length) {
    return [];
  }

  const body = [
    `fields ${releaseGameFields()};`,
    `where first_release_date >= ${minReleaseDate} & first_release_date <= ${maxReleaseDate} & id != ${sourceIgdbId} & ${field} = (${uniqueIds.join(",")});`,
    "sort first_release_date asc;",
    "limit 30;",
  ].join(" ");

  return queryIgdbReleaseGames(body);
}

function getDirectRelationIds(source: IgdbReleaseGameRecord) {
  const relations: Array<{
    ids: number[];
    relationType: UpcomingReleaseRelationType;
  }> = [
    { ids: readReferenceIds(source.dlcs), relationType: "dlc" },
    { ids: readReferenceIds(source.expansions), relationType: "expansion" },
    {
      ids: readReferenceIds(source.standalone_expansions),
      relationType: "standalone_expansion",
    },
    {
      ids: readReferenceIds(source.expanded_games),
      relationType: "expanded_game",
    },
    { ids: readReferenceIds(source.remakes), relationType: "remake" },
    { ids: readReferenceIds(source.remasters), relationType: "remaster" },
  ];
  const relationById = new Map<number, UpcomingReleaseRelationType>();

  for (const relation of relations) {
    for (const id of relation.ids) {
      relationById.set(id, relation.relationType);
    }
  }

  return relationById;
}

function getRelationType(
  game: IgdbReleaseGameRecord,
  directRelationType?: UpcomingReleaseRelationType,
): UpcomingReleaseRelationType {
  if (directRelationType) {
    return directRelationType;
  }

  const gameType = readGameType(game.game_type)?.toLowerCase() ?? "";
  if (gameType.includes("dlc")) {
    return "dlc";
  }
  if (gameType.includes("standalone")) {
    return "standalone_expansion";
  }
  if (gameType.includes("expansion")) {
    return "expansion";
  }
  if (gameType.includes("remake")) {
    return "remake";
  }
  if (gameType.includes("remaster")) {
    return "remaster";
  }
  if (gameType.includes("expanded")) {
    return "expanded_game";
  }

  return "sequel_or_related";
}

function mapUpcomingRelease(
  game: IgdbReleaseGameRecord,
  relationType?: UpcomingReleaseRelationType,
): IgdbUpcomingRelease | null {
  const releaseDate = toIsoDateFromUnix(game.first_release_date);
  if (!releaseDate) {
    return null;
  }

  return {
    provider: "IGDB",
    providerGameId: String(game.id),
    igdbId: game.id,
    title: game.name,
    slug: game.slug ?? null,
    summary: game.summary ?? null,
    releaseDate,
    relationType: getRelationType(game, relationType),
    gameType: readGameType(game.game_type),
    parentGameIgdbId:
      readReferenceId(game.parent_game) ??
      readReferenceId(game.version_parent),
    url: game.url ?? null,
    franchiseNames: readReferenceNames([
      ...(game.franchise ? [game.franchise] : []),
      ...(game.franchises ?? []),
    ]),
    collectionNames: readReferenceNames(game.collections),
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

export async function searchUpcomingRelatedIgdbReleases({
  horizonDays = 365,
  igdbId,
  now = new Date(),
}: {
  horizonDays?: number;
  igdbId: number;
  now?: Date;
}): Promise<IgdbUpcomingReleaseLookup | null> {
  const source = await fetchIgdbReleaseSeed(igdbId);
  if (!source) {
    return null;
  }

  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const minReleaseDate = Math.floor(startOfToday.getTime() / 1000);
  const maxReleaseDate = Math.floor(
    (startOfToday.getTime() + horizonDays * 24 * 60 * 60 * 1000) / 1000,
  );
  const directRelationById = getDirectRelationIds(source);
  const franchiseIds = readReferenceIds([
    ...(source.franchise ? [source.franchise] : []),
    ...(source.franchises ?? []),
  ]);
  const collectionIds = readReferenceIds(source.collections);
  const [directGames, franchiseGames, collectionGames] = await Promise.all([
    fetchIgdbReleaseGamesByIds([...directRelationById.keys()]),
    fetchUpcomingIgdbReleaseGamesByReference({
      field: "franchises",
      ids: franchiseIds,
      minReleaseDate,
      maxReleaseDate,
      sourceIgdbId: source.id,
    }),
    fetchUpcomingIgdbReleaseGamesByReference({
      field: "collections",
      ids: collectionIds,
      minReleaseDate,
      maxReleaseDate,
      sourceIgdbId: source.id,
    }),
  ]);
  const releaseById = new Map<number, IgdbUpcomingRelease>();

  for (const game of [...directGames, ...franchiseGames, ...collectionGames]) {
    if (
      game.id === source.id ||
      !game.first_release_date ||
      game.first_release_date < minReleaseDate ||
      game.first_release_date > maxReleaseDate
    ) {
      continue;
    }

    const release = mapUpcomingRelease(
      game,
      directRelationById.get(game.id),
    );
    if (release) {
      releaseById.set(release.igdbId, release);
    }
  }

  return {
    source: "IGDB",
    sourceGame: {
      igdbId: source.id,
      name: source.name,
      slug: source.slug ?? null,
      url: source.url ?? null,
    },
    relationKeys: {
      franchiseNames: readReferenceNames([
        ...(source.franchise ? [source.franchise] : []),
        ...(source.franchises ?? []),
      ]),
      collectionNames: readReferenceNames(source.collections),
    },
    releases: [...releaseById.values()].sort(
      (left, right) =>
        new Date(left.releaseDate).getTime() -
        new Date(right.releaseDate).getTime(),
    ),
  };
}

export function hasIgdbConfig() {
  return isIgdbConfigured();
}

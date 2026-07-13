export type ProviderProfile = {
  providerAccountId: string;
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  profileUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export type SyncedLibraryGame = {
  providerGameId: string;
  providerGameIds?: string[];
  title: string;
  platformName?: string | null;
  playtimeMinutes?: number | null;
  lastPlayedAt?: Date | null;
  completionPercent?: number | null;
  storeUrl?: string | null;
  rawData?: Record<string, unknown>;
};

export type EnrichedGameMetadata = {
  igdbId: number;
  slug?: string | null;
  name: string;
  summary?: string | null;
  coverUrl?: string | null;
  heroUrl?: string | null;
  releaseDate?: Date | null;
  aggregatedRating?: number | null;
  totalRatingCount?: number | null;
  genres?: string[];
  platforms?: string[];
  screenshots?: string[];
  websites?: string[];
};

export type EnrichedCompletionTimes = {
  hltbId: string;
  name: string;
  mainStoryMinutes?: number | null;
  mainExtraMinutes?: number | null;
  completionistMinutes?: number | null;
  platforms?: string[];
  similarity?: number | null;
  storeUrl?: string | null;
  rawData?: Record<string, unknown>;
};

export type EnrichedReviewScore = {
  providerGameId: string;
  score: number;
  url?: string | null;
  sourceProvider?: string | null;
  rawData?: Record<string, unknown>;
};

export interface ProviderAccountAdapter {
  provider: "STEAM";
  fetchProfile(
    providerAccountId: string,
    options?: { signal?: AbortSignal },
  ): Promise<ProviderProfile>;
  syncOwnedLibrary(
    providerAccountId: string,
    options?: { signal?: AbortSignal },
  ): Promise<SyncedLibraryGame[]>;
}

export interface CatalogMetadataAdapter {
  provider: "IGDB";
  searchBestMatch(query: {
    title: string;
    platformName?: string | null;
  }): Promise<EnrichedGameMetadata | null>;
}

export interface CatalogCompletionTimeAdapter {
  provider: "HLTB";
  searchBestMatch(query: {
    title: string;
    platformName?: string | null;
  }): Promise<EnrichedCompletionTimes | null>;
}

export interface CatalogReviewScoreAdapter {
  provider: "METACRITIC";
  searchBestMatch(query: {
    title: string;
    steamAppId?: string | null;
  }): Promise<EnrichedReviewScore | null>;
}

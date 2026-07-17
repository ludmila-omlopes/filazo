import type { PurchasedGame, TrophyTitle } from "psn-api";
import type { SyncedLibraryGame } from "./providers/contracts.ts";
import { normalizeTitle } from "./utils.ts";

export type PlayStationPlayedGame = {
  titleId: string;
  name: string;
  localizedName: string;
  imageUrl: string;
  localizedImageUrl: string;
  category: string;
  service: string;
  playCount: number;
  concept: {
    id: number;
    titleIds: string[];
    name: string;
    media: {
      audios: unknown[];
      videos: unknown[];
      images: Array<{ url: string; format: string; type: string }>;
    };
  };
  media: { screenshotUrl?: string; [key: string]: string | undefined };
  firstPlayedDateTime: string;
  lastPlayedDateTime: string;
  playDuration: string;
};

export function parsePlayStationDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

export function parsePlayStationDurationMinutes(
  value: string | null | undefined,
) {
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

export function isPlayStationNonGameCategory(
  category: string | null | undefined,
) {
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

export function getPlayStationPlayedPlatformName(
  category: string | null | undefined,
) {
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

export function normalizePlayStationPlatformName(value: string) {
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

export function formatPlayStationPlatform(value: string) {
  return uniqueValues(
    value
      .split(",")
      .map((platform) => normalizePlayStationPlatformName(platform))
      .filter(Boolean),
  ).join(", ");
}

export function createConceptStoreUrl(conceptId: string | null | undefined) {
  return conceptId
    ? `https://store.playstation.com/concept/${encodeURIComponent(conceptId)}`
    : null;
}

export function createProviderGameIds(values: {
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

export function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

export function getSyncedGameProviderGameIds(game: SyncedLibraryGame) {
  return uniqueValues([game.providerGameId, ...(game.providerGameIds ?? [])]);
}

export function mapTitleToSyncedGame(title: TrophyTitle): SyncedLibraryGame {
  const providerGameIds = createProviderGameIds({
    npCommunicationId: title.npCommunicationId,
  });

  return {
    providerGameId:
      providerGameIds[0] ?? `npCommunicationId:${title.npCommunicationId}`,
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
      lastTrophyUpdatedAt:
        parsePlayStationDate(title.lastUpdatedDateTime)?.toISOString() ?? null,
      trophyTitleDetail: title.trophyTitleDetail ?? null,
    },
  };
}

export function mapPurchasedGameToSyncedGame(
  game: PurchasedGame,
): SyncedLibraryGame {
  const providerGameIds = createProviderGameIds({
    conceptId: game.conceptId,
    entitlementId: game.entitlementId,
    productId: game.productId,
    titleId: game.titleId,
  });

  return {
    providerGameId: providerGameIds[0] ?? `productId:${game.productId}`,
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

export function mapPlayedGameToSyncedGame(
  game: PlayStationPlayedGame,
): SyncedLibraryGame {
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

export function mergePlayStationSyncedGames(
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
    const nextProviderIds = uniqueValues([
      ...existingProviderIds,
      ...providerIds,
    ]);
    existing.providerGameIds = nextProviderIds;
    existing.providerGameId =
      existingProviderIds.find((providerId) =>
        providerId.startsWith("titleId:"),
      ) ??
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
            Math.max(
              game.lastPlayedAt.getTime(),
              existing.lastPlayedAt.getTime(),
            ),
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

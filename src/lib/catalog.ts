import {
  EntrySource,
  ExternalProvider,
  ImportJobStatus,
  ImportRowStatus,
  type Prisma,
  UserGameStatus,
} from "@prisma/client";
import Papa from "papaparse";
import {
  shouldSearchHltb,
  shouldSearchIgdb,
  shouldSearchMetacritic,
} from "@/lib/enrichment-policy";
import { hltbAdapter } from "@/lib/hltb";
import { igdbAdapter } from "@/lib/igdb";
import { metacriticAdapter } from "@/lib/metacritic";
import {
  canonicalizePlayStationGameTitle,
  getPlayStationArtworkFallback,
} from "@/lib/playstation-catalog";
import { syncPlayStationLibraryForAccount } from "@/lib/playstation";
import { prisma } from "@/lib/prisma";
import { getSteamStoreArtwork, steamAdapter } from "@/lib/steam";
import { syncXboxLibraryForAccount } from "@/lib/xbox";
import type { CsvColumnMapping } from "@/lib/csv-import-mapping";
import { getBacklogEstimate } from "@/lib/play-planning";
import { getSyncedPlaytimeData } from "@/lib/playtime-conflict";
import {
  canonicalizeGameTitle,
  cleanGameTitle,
  normalizeTitle,
  slugify,
  uniqueSlug,
} from "@/lib/utils";

type ResolveGameInput = {
  title: string;
  platformName?: string | null;
  metadata?: Awaited<ReturnType<typeof igdbAdapter.searchBestMatch>> | null;
  provider?: ExternalProvider;
  providerGameId?: string | null;
  storeUrl?: string | null;
  rawData?: Record<string, unknown>;
};

type NormalizedImportRow = {
  title: string;
  platformName?: string | null;
  status: UserGameStatus;
  playtimeMinutes?: number | null;
  completionPercent?: number | null;
  notes?: string | null;
  externalId?: string | null;
  rawData: Record<string, unknown>;
};

function isJsonRecord(
  value: Prisma.JsonValue | null | undefined,
): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPlayStationNonGameCategory(category: string | null | undefined) {
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

function getPlayStationSyncSources(rawData: Prisma.JsonValue | null | undefined) {
  if (!isJsonRecord(rawData)) {
    return [];
  }

  const value = rawData.playStationSyncSources;
  return Array.isArray(value)
    ? value.filter((item): item is Prisma.JsonObject => isJsonRecord(item))
    : [];
}

async function prunePlayStationNonGameEntries(externalAccountId: string) {
  const entries = await prisma.userGameEntry.findMany({
    where: {
      provider: ExternalProvider.PLAYSTATION,
      externalAccountId,
    },
    select: {
      id: true,
      rawData: true,
    },
  });

  const entryIdsToDelete = entries
    .filter((entry) => {
      const sources = getPlayStationSyncSources(entry.rawData);
      if (!sources.length) {
        return false;
      }

      const hasPlayedSource = sources.some(
        (source) => source.syncSource === "played-game",
      );
      const hasNonPlayedSource = sources.some(
        (source) => source.syncSource !== "played-game",
      );
      const hasNonGameCategory = sources.some(
        (source) =>
          source.syncSource === "played-game" &&
          typeof source.category === "string" &&
          isPlayStationNonGameCategory(source.category),
      );

      return hasPlayedSource && !hasNonPlayedSource && hasNonGameCategory;
    })
    .map((entry) => entry.id);

  if (!entryIdsToDelete.length) {
    return 0;
  }

  const result = await prisma.userGameEntry.deleteMany({
    where: {
      id: {
        in: entryIdsToDelete,
      },
    },
  });

  return result.count;
}

function getProviderArtworkFallback(input: ResolveGameInput) {
  if (
    input.provider === ExternalProvider.STEAM &&
    input.providerGameId
  ) {
    return getSteamStoreArtwork(input.providerGameId);
  }

  if (input.provider === ExternalProvider.PLAYSTATION) {
    return getPlayStationArtworkFallback(input.rawData);
  }

  return null;
}

async function applyProviderArtworkFallback(
  gameId: string,
  existingGame: {
    coverUrl: string | null;
    heroUrl: string | null;
  },
  input: ResolveGameInput,
) {
  const artwork = getProviderArtworkFallback(input);
  if (!artwork) {
    return prisma.game.findUniqueOrThrow({ where: { id: gameId } });
  }

  if (existingGame.coverUrl && existingGame.heroUrl) {
    return prisma.game.findUniqueOrThrow({ where: { id: gameId } });
  }

  return prisma.game.update({
    where: { id: gameId },
    data: {
      coverUrl: existingGame.coverUrl ?? artwork.coverUrl,
      heroUrl: existingGame.heroUrl ?? artwork.heroUrl,
    },
  });
}

function metadataToGameCreateInput(
  title: string,
  metadata?: Awaited<ReturnType<typeof igdbAdapter.searchBestMatch>> | null,
): Prisma.GameCreateInput {
  const slugBase = metadata?.slug ?? slugify(title);

  return {
    slug: metadata?.igdbId
      ? uniqueSlug(slugBase, String(metadata.igdbId))
      : uniqueSlug(slugBase, crypto.randomUUID().slice(0, 6)),
    name: metadata?.name ?? title,
    normalizedName: normalizeTitle(metadata?.name ?? title),
    summary: metadata?.summary ?? null,
    coverUrl: metadata?.coverUrl ?? null,
    heroUrl: metadata?.heroUrl ?? null,
    releaseDate: metadata?.releaseDate ?? null,
    aggregatedRating: metadata?.aggregatedRating ?? null,
    totalRatingCount: metadata?.totalRatingCount ?? null,
    genres: metadata?.genres ?? [],
    platforms: metadata?.platforms ?? [],
    screenshots: metadata?.screenshots ?? [],
    websites: metadata?.websites ?? [],
    metadataSource: metadata ? ExternalProvider.IGDB : null,
    igdbId: metadata?.igdbId ?? null,
    igdbSlug: metadata?.slug ?? null,
  };
}

async function applyMetadataToExistingGame(
  gameId: string,
  metadata: Awaited<ReturnType<typeof igdbAdapter.searchBestMatch>>,
) {
  if (!metadata) {
    return prisma.game.findUniqueOrThrow({ where: { id: gameId } });
  }

  return prisma.game.update({
    where: { id: gameId },
    data: {
      name: metadata.name,
      normalizedName: normalizeTitle(metadata.name),
      summary: metadata.summary ?? undefined,
      coverUrl: metadata.coverUrl ?? undefined,
      heroUrl: metadata.heroUrl ?? undefined,
      releaseDate: metadata.releaseDate ?? undefined,
      aggregatedRating: metadata.aggregatedRating ?? undefined,
      totalRatingCount: metadata.totalRatingCount ?? undefined,
      genres: metadata.genres ?? [],
      platforms: metadata.platforms ?? [],
      screenshots: metadata.screenshots ?? [],
      websites: metadata.websites ?? [],
      metadataSource: ExternalProvider.IGDB,
      igdbId: metadata.igdbId,
      igdbSlug: metadata.slug ?? undefined,
    },
  });
}

async function applyCompletionTimesToGame(
  gameId: string,
  completionTimes: Awaited<ReturnType<typeof hltbAdapter.searchBestMatch>>,
) {
  if (!completionTimes) {
    return prisma.game.findUniqueOrThrow({ where: { id: gameId } });
  }

  const game = await prisma.game.update({
    where: { id: gameId },
    data: {
      hltbMainStoryMinutes: completionTimes.mainStoryMinutes ?? undefined,
      hltbMainExtraMinutes: completionTimes.mainExtraMinutes ?? undefined,
      hltbCompletionistMinutes:
        completionTimes.completionistMinutes ?? undefined,
      hltbUpdatedAt: new Date(),
    },
  });

  await prisma.gameProviderLink.upsert({
    where: {
      provider_providerGameId: {
        provider: ExternalProvider.HLTB,
        providerGameId: completionTimes.hltbId,
      },
    },
    update: {
      gameId: game.id,
      storeUrl: completionTimes.storeUrl ?? undefined,
      rawData: completionTimes.rawData as Prisma.InputJsonValue | undefined,
    },
    create: {
      gameId: game.id,
      provider: ExternalProvider.HLTB,
      providerGameId: completionTimes.hltbId,
      storeUrl: completionTimes.storeUrl ?? undefined,
      rawData: completionTimes.rawData as Prisma.InputJsonValue | undefined,
    },
  });

  return game;
}

async function applyReviewScoreToGame(
  gameId: string,
  reviewScore: Awaited<ReturnType<typeof metacriticAdapter.searchBestMatch>>,
) {
  if (!reviewScore) {
    return prisma.game.findUniqueOrThrow({ where: { id: gameId } });
  }

  const game = await prisma.game.update({
    where: { id: gameId },
    data: {
      metacriticScore: reviewScore.score,
      metacriticUrl: reviewScore.url ?? undefined,
      metacriticUpdatedAt: new Date(),
    },
  });

  await prisma.gameProviderLink.upsert({
    where: {
      provider_providerGameId: {
        provider: ExternalProvider.METACRITIC,
        providerGameId: reviewScore.providerGameId,
      },
    },
    update: {
      gameId: game.id,
      storeUrl: reviewScore.url ?? undefined,
      rawData: reviewScore.rawData as Prisma.InputJsonValue | undefined,
    },
    create: {
      gameId: game.id,
      provider: ExternalProvider.METACRITIC,
      providerGameId: reviewScore.providerGameId,
      storeUrl: reviewScore.url ?? undefined,
      rawData: reviewScore.rawData as Prisma.InputJsonValue | undefined,
    },
  });

  return game;
}

export async function resolveCatalogGame(input: ResolveGameInput) {
  const canonicalTitle = canonicalizeGameTitle(input.title);
  const normalizedTitle = normalizeTitle(canonicalTitle);
  const searchTitle = cleanGameTitle(canonicalTitle);
  let game:
    | Awaited<ReturnType<typeof prisma.game.findFirst>>
    | Awaited<ReturnType<typeof prisma.game.findUnique>>
    | null = null;

  if (input.provider && input.providerGameId) {
    const existingLink = await prisma.gameProviderLink.findUnique({
      where: {
        provider_providerGameId: {
          provider: input.provider,
          providerGameId: input.providerGameId,
        },
      },
      include: {
        game: true,
      },
    });

    if (existingLink) {
      game = existingLink.game;
    }
  }

  if (!game) {
    game = await prisma.game.findFirst({
      where: {
        normalizedName: normalizedTitle,
      },
    });
  }

  const initiallyMatchedGame = game;
  const metadata =
    input.metadata ??
    (shouldSearchIgdb(initiallyMatchedGame)
      ? await igdbAdapter.searchBestMatch({
          title: searchTitle,
          platformName: input.platformName,
        })
      : null);

  if (metadata?.igdbId) {
    const gameByIgdb = await prisma.game.findUnique({
      where: {
        igdbId: metadata.igdbId,
      },
    });
    game = gameByIgdb ?? game;
  }

  const enrichmentSearchTitle = cleanGameTitle(metadata?.name ?? input.title);
  const completionTimes = shouldSearchHltb(initiallyMatchedGame)
    ? await hltbAdapter.searchBestMatch({
        title: enrichmentSearchTitle,
        platformName: input.platformName,
      })
    : null;
  const reviewScore = shouldSearchMetacritic(initiallyMatchedGame)
    ? await metacriticAdapter.searchBestMatch({
        title: enrichmentSearchTitle,
        steamAppId:
          input.provider === ExternalProvider.STEAM
            ? input.providerGameId
            : null,
      })
    : null;

  if (completionTimes?.hltbId) {
    const gameByHltb = await prisma.gameProviderLink.findUnique({
      where: {
        provider_providerGameId: {
          provider: ExternalProvider.HLTB,
          providerGameId: completionTimes.hltbId,
        },
      },
      include: {
        game: true,
      },
    });
    game = gameByHltb?.game ?? game;
  }

  if (!game) {
    game = await prisma.game.create({
      data: metadataToGameCreateInput(canonicalTitle, metadata),
    });
  }

  if (
    metadata &&
    (!game.igdbId || !game.coverUrl || !game.heroUrl || !game.summary)
  ) {
    game = await applyMetadataToExistingGame(game.id, metadata);
  } else if (!game.coverUrl || !game.heroUrl) {
    game = await applyProviderArtworkFallback(game.id, game, input);
  }

  if (
    completionTimes &&
    (!game.hltbMainStoryMinutes ||
      !game.hltbMainExtraMinutes ||
      !game.hltbCompletionistMinutes)
  ) {
    game = await applyCompletionTimesToGame(game.id, completionTimes);
  }

  if (
    reviewScore &&
    (game.metacriticScore !== reviewScore.score ||
      game.metacriticUrl !== reviewScore.url)
  ) {
    game = await applyReviewScoreToGame(game.id, reviewScore);
  }

  if (input.provider && input.providerGameId) {
    await prisma.gameProviderLink.upsert({
      where: {
        provider_providerGameId: {
          provider: input.provider,
          providerGameId: input.providerGameId,
        },
      },
      update: {
        gameId: game.id,
        storeUrl: input.storeUrl ?? undefined,
        rawData: input.rawData as Prisma.InputJsonValue | undefined,
      },
      create: {
        gameId: game.id,
        provider: input.provider,
        providerGameId: input.providerGameId,
        storeUrl: input.storeUrl ?? undefined,
        rawData: input.rawData as Prisma.InputJsonValue | undefined,
      },
    });
  }

  if (
    metadata?.igdbId &&
    (input.provider !== ExternalProvider.IGDB ||
      input.providerGameId !== String(metadata.igdbId))
  ) {
    await prisma.gameProviderLink.upsert({
      where: {
        provider_providerGameId: {
          provider: ExternalProvider.IGDB,
          providerGameId: String(metadata.igdbId),
        },
      },
      update: {
        gameId: game.id,
      },
      create: {
        gameId: game.id,
        provider: ExternalProvider.IGDB,
        providerGameId: String(metadata.igdbId),
      },
    });
  }

  return game;
}

async function applySyncedPlaytimeToActiveEntries({
  gameId,
  ownedEntryId,
  syncedMinutes,
  userId,
}: {
  gameId: string;
  ownedEntryId?: string;
  syncedMinutes: number | null | undefined;
  userId: string;
}) {
  if (syncedMinutes === null || syncedMinutes === undefined) return;
  const activeEntries = await prisma.userGameEntry.findMany({
    where: {
      userId,
      gameId,
      id: ownedEntryId ? { not: ownedEntryId } : undefined,
      OR: [
        { currentPlayingSlot: { not: null } },
        { status: UserGameStatus.PLAYING },
        { playtimeSource: "manual" },
      ],
    },
    select: { id: true, playtimeMinutes: true, playtimeSource: true },
  });
  for (const entry of activeEntries) {
    await prisma.userGameEntry.update({
      where: { id: entry.id },
      data: getSyncedPlaytimeData(entry, syncedMinutes),
    });
  }
}

export async function syncSteamLibraryForUser(userId: string) {
  const steamAccount = await prisma.externalAccount.findFirst({
    where: {
      userId,
      provider: ExternalProvider.STEAM,
    },
  });

  if (!steamAccount) {
    throw new Error("Connect a Steam account before syncing your library.");
  }

  const [profile, games] = await Promise.all([
    steamAdapter.fetchProfile(steamAccount.providerAccountId),
    steamAdapter.syncOwnedLibrary(steamAccount.providerAccountId),
  ]);

  await prisma.user.update({
    where: { id: userId },
    data: {
      displayName: profile.displayName ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
    },
  });

  await prisma.externalAccount.update({
    where: { id: steamAccount.id },
    data: {
      username: profile.username ?? undefined,
      displayName: profile.displayName ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
      profileUrl: profile.profileUrl ?? undefined,
      metadata: profile.metadata as Prisma.InputJsonValue | undefined,
      lastSyncedAt: new Date(),
    },
  });

  let syncedCount = 0;

  for (const syncedGame of games) {
    const game = await resolveCatalogGame({
      title: syncedGame.title,
      platformName: syncedGame.platformName,
      provider: ExternalProvider.STEAM,
      providerGameId: syncedGame.providerGameId,
      storeUrl: syncedGame.storeUrl,
      rawData: syncedGame.rawData,
    });

    const existingEntry = await prisma.userGameEntry.findUnique({
      where: { userId_gameId_status: { userId, gameId: game.id, status: UserGameStatus.OWNED } },
      select: { id: true, playtimeMinutes: true, playtimeSource: true },
    });
    await applySyncedPlaytimeToActiveEntries({ userId, gameId: game.id, ownedEntryId: existingEntry?.id, syncedMinutes: syncedGame.playtimeMinutes });
    const playtimeData = getSyncedPlaytimeData(existingEntry, syncedGame.playtimeMinutes);
    await prisma.userGameEntry.upsert({
      where: {
        userId_gameId_status: {
          userId,
          gameId: game.id,
          status: UserGameStatus.OWNED,
        },
      },
      update: {
        source: EntrySource.STEAM,
        provider: ExternalProvider.STEAM,
        externalAccountId: steamAccount.id,
        platformName: syncedGame.platformName ?? undefined,
        ...playtimeData,
        lastPlayedAt: syncedGame.lastPlayedAt ?? null,
        completionPercent: syncedGame.completionPercent ?? null,
        rawData: syncedGame.rawData as Prisma.InputJsonValue | undefined,
        lastSyncedAt: new Date(),
      },
      create: {
        userId,
        gameId: game.id,
        status: UserGameStatus.OWNED,
        source: EntrySource.STEAM,
        provider: ExternalProvider.STEAM,
        externalAccountId: steamAccount.id,
        platformName: syncedGame.platformName ?? undefined,
        playtimeMinutes: syncedGame.playtimeMinutes ?? undefined,
        playtimeSource: syncedGame.playtimeMinutes !== null && syncedGame.playtimeMinutes !== undefined ? "sync" : undefined,
        lastPlayedAt: syncedGame.lastPlayedAt ?? null,
        completionPercent: syncedGame.completionPercent ?? null,
        rawData: syncedGame.rawData as Prisma.InputJsonValue | undefined,
        lastSyncedAt: new Date(),
      },
    });

    syncedCount += 1;
  }

  return {
    syncedCount,
    profile,
  };
}

export async function syncPlayStationLibraryForUser(userId: string) {
  const playStationAccount = await prisma.externalAccount.findFirst({
    where: {
      userId,
      provider: ExternalProvider.PLAYSTATION,
    },
  });

  if (!playStationAccount) {
    throw new Error("Connect PlayStation before syncing your played catalog.");
  }

  const { profile, games } = await syncPlayStationLibraryForAccount(
    playStationAccount,
  );

  let syncedCount = 0;

  for (const syncedGame of games) {
    const providerGameIds = Array.from(
      new Set([syncedGame.providerGameId, ...(syncedGame.providerGameIds ?? [])]),
    );
    const game = await resolveCatalogGame({
      title: canonicalizePlayStationGameTitle(syncedGame.title),
      platformName: syncedGame.platformName,
      provider: ExternalProvider.PLAYSTATION,
      providerGameId: syncedGame.providerGameId,
      storeUrl: syncedGame.storeUrl,
      rawData: syncedGame.rawData,
    });

    for (const providerGameId of providerGameIds) {
      await prisma.gameProviderLink.upsert({
        where: {
          provider_providerGameId: {
            provider: ExternalProvider.PLAYSTATION,
            providerGameId,
          },
        },
        update: {
          gameId: game.id,
          storeUrl: syncedGame.storeUrl ?? undefined,
          rawData: syncedGame.rawData as Prisma.InputJsonValue | undefined,
        },
        create: {
          gameId: game.id,
          provider: ExternalProvider.PLAYSTATION,
          providerGameId,
          storeUrl: syncedGame.storeUrl ?? undefined,
          rawData: syncedGame.rawData as Prisma.InputJsonValue | undefined,
        },
      });
    }

    const existingEntry = await prisma.userGameEntry.findUnique({
      where: { userId_gameId_status: { userId, gameId: game.id, status: UserGameStatus.OWNED } },
      select: { id: true, playtimeMinutes: true, playtimeSource: true },
    });
    await applySyncedPlaytimeToActiveEntries({ userId, gameId: game.id, ownedEntryId: existingEntry?.id, syncedMinutes: syncedGame.playtimeMinutes });
    const playtimeData = getSyncedPlaytimeData(existingEntry, syncedGame.playtimeMinutes);
    await prisma.userGameEntry.upsert({
      where: {
        userId_gameId_status: {
          userId,
          gameId: game.id,
          status: UserGameStatus.OWNED,
        },
      },
      update: {
        source: EntrySource.PLAYSTATION,
        provider: ExternalProvider.PLAYSTATION,
        externalAccountId: playStationAccount.id,
        platformName: syncedGame.platformName ?? undefined,
        ...playtimeData,
        lastPlayedAt: syncedGame.lastPlayedAt ?? null,
        completionPercent: syncedGame.completionPercent ?? null,
        rawData: syncedGame.rawData as Prisma.InputJsonValue | undefined,
        lastSyncedAt: new Date(),
      },
      create: {
        userId,
        gameId: game.id,
        status: UserGameStatus.OWNED,
        source: EntrySource.PLAYSTATION,
        provider: ExternalProvider.PLAYSTATION,
        externalAccountId: playStationAccount.id,
        platformName: syncedGame.platformName ?? undefined,
        playtimeMinutes: syncedGame.playtimeMinutes ?? undefined,
        playtimeSource: syncedGame.playtimeMinutes !== null && syncedGame.playtimeMinutes !== undefined ? "sync" : undefined,
        lastPlayedAt: syncedGame.lastPlayedAt ?? null,
        completionPercent: syncedGame.completionPercent ?? null,
        rawData: syncedGame.rawData as Prisma.InputJsonValue | undefined,
        lastSyncedAt: new Date(),
      },
    });

    syncedCount += 1;
  }

  await prunePlayStationNonGameEntries(playStationAccount.id);

  return {
    syncedCount,
    profile,
  };
}

export async function syncXboxLibraryForUser(userId: string) {
  const xboxAccount = await prisma.externalAccount.findFirst({
    where: {
      userId,
      provider: ExternalProvider.XBOX,
    },
  });

  if (!xboxAccount) {
    throw new Error("Connect Xbox before syncing your played catalog.");
  }

  const { profile, games } = await syncXboxLibraryForAccount(xboxAccount);

  let syncedCount = 0;

  for (const syncedGame of games) {
    const providerGameIds = Array.from(
      new Set([syncedGame.providerGameId, ...(syncedGame.providerGameIds ?? [])]),
    );
    const game = await resolveCatalogGame({
      title: syncedGame.title,
      platformName: syncedGame.platformName,
      provider: ExternalProvider.XBOX,
      providerGameId: syncedGame.providerGameId,
      storeUrl: syncedGame.storeUrl,
      rawData: syncedGame.rawData,
    });

    for (const providerGameId of providerGameIds) {
      await prisma.gameProviderLink.upsert({
        where: {
          provider_providerGameId: {
            provider: ExternalProvider.XBOX,
            providerGameId,
          },
        },
        update: {
          gameId: game.id,
          storeUrl: syncedGame.storeUrl ?? undefined,
          rawData: syncedGame.rawData as Prisma.InputJsonValue | undefined,
        },
        create: {
          gameId: game.id,
          provider: ExternalProvider.XBOX,
          providerGameId,
          storeUrl: syncedGame.storeUrl ?? undefined,
          rawData: syncedGame.rawData as Prisma.InputJsonValue | undefined,
        },
      });
    }

    await prisma.userGameEntry.upsert({
      where: {
        userId_gameId_status: {
          userId,
          gameId: game.id,
          status: UserGameStatus.OWNED,
        },
      },
      update: {
        source: EntrySource.XBOX,
        provider: ExternalProvider.XBOX,
        externalAccountId: xboxAccount.id,
        platformName: syncedGame.platformName ?? undefined,
        completionPercent: syncedGame.completionPercent ?? null,
        lastPlayedAt: syncedGame.lastPlayedAt ?? null,
        rawData: syncedGame.rawData as Prisma.InputJsonValue | undefined,
        lastSyncedAt: new Date(),
      },
      create: {
        userId,
        gameId: game.id,
        status: UserGameStatus.OWNED,
        source: EntrySource.XBOX,
        provider: ExternalProvider.XBOX,
        externalAccountId: xboxAccount.id,
        platformName: syncedGame.platformName ?? undefined,
        completionPercent: syncedGame.completionPercent ?? null,
        lastPlayedAt: syncedGame.lastPlayedAt ?? null,
        rawData: syncedGame.rawData as Prisma.InputJsonValue | undefined,
        lastSyncedAt: new Date(),
      },
    });

    syncedCount += 1;
  }

  return {
    syncedCount,
    profile,
  };
}

function parseStatus(rawValue: unknown) {
  const normalized = String(rawValue ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return UserGameStatus.OWNED;
  }
  if (normalized.includes("wish")) {
    return UserGameStatus.WISHLIST;
  }
  if (
    normalized.includes("playing next") ||
    normalized.includes("play next") ||
    normalized.includes("up next") ||
    normalized === "next"
  ) {
    return UserGameStatus.PLAYING_NEXT;
  }
  if (normalized.includes("play")) {
    return UserGameStatus.PLAYING;
  }
  if (normalized.includes("complete") || normalized.includes("finish")) {
    return UserGameStatus.COMPLETED;
  }
  if (
    normalized.includes("drop") ||
    normalized.includes("abandon") ||
    normalized.includes("release")
  ) {
    return UserGameStatus.DROPPED;
  }
  if (normalized.includes("backlog")) {
    return UserGameStatus.BACKLOG;
  }

  return UserGameStatus.OWNED;
}

function parseCompletionPercent(rawValue: unknown) {
  const normalized = String(rawValue ?? "")
    .trim()
    .replace(",", ".");

  if (!normalized) {
    return null;
  }

  const numericValue = Number(normalized.replace(/%$/, "").trim());
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const percent =
    numericValue > 0 && numericValue <= 1 && normalized.includes(".")
      ? numericValue * 100
      : numericValue;

  return Math.min(100, Math.max(0, Math.round(percent)));
}

function parseCsvImportProvider(
  value: CsvColumnMapping["provider"],
): ExternalProvider | null {
  if (value === ExternalProvider.PLAYSTATION) {
    return ExternalProvider.PLAYSTATION;
  }

  if (value === ExternalProvider.XBOX) {
    return ExternalProvider.XBOX;
  }

  return null;
}

function getDefaultPlatformName(provider: ExternalProvider | null) {
  if (provider === ExternalProvider.PLAYSTATION) {
    return "PlayStation";
  }

  if (provider === ExternalProvider.XBOX) {
    return "Xbox";
  }

  return null;
}

function normalizeCsvRows(
  csvText: string,
  mapping: CsvColumnMapping,
): NormalizedImportRow[] {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const normalizedRows: Array<NormalizedImportRow | null> = (parsed.data ?? []).map((row) => {
    const title = String(row[mapping.title] ?? "").trim();
    if (!title) {
      return null;
    }

    const playtimeValue = mapping.playtimeHours
      ? String(row[mapping.playtimeHours] ?? "").trim()
      : "";
    const playtimeHours = playtimeValue ? Number(playtimeValue) : null;
    const status = parseStatus(mapping.status ? row[mapping.status] : undefined);
    // completionPercent tracks achievement/trophy progress only. A COMPLETED
    // status means the credits rolled, which says nothing about achievements,
    // so it must not be backfilled to 100.
    const completionPercent = mapping.completionPercent
      ? parseCompletionPercent(row[mapping.completionPercent])
      : null;

    return {
      title,
      platformName: mapping.platform
        ? String(row[mapping.platform] ?? "").trim() || null
        : null,
      status,
      playtimeMinutes:
        playtimeHours !== null && Number.isFinite(playtimeHours)
          ? Math.round(playtimeHours * 60)
          : null,
      completionPercent,
      notes: mapping.notes
        ? String(row[mapping.notes] ?? "").trim() || null
        : null,
      externalId: mapping.externalId
        ? String(row[mapping.externalId] ?? "").trim() || null
        : null,
      rawData: row,
    };
  });

  return normalizedRows.filter(
    (row): row is NormalizedImportRow => row !== null,
  );
}

export async function importCsvForUser({
  userId,
  fileName,
  csvText,
  mapping,
}: {
  userId: string;
  fileName: string;
  csvText: string;
  mapping: CsvColumnMapping;
}) {
  const job = await prisma.importJob.create({
    data: {
      userId,
      fileName,
      status: ImportJobStatus.PROCESSING,
      columnMapping: mapping as Prisma.InputJsonValue,
    },
  });

  try {
    const rows = normalizeCsvRows(csvText, mapping);
    const importProvider = parseCsvImportProvider(mapping.provider);
    const defaultPlatformName = getDefaultPlatformName(importProvider);
    let importedCount = 0;
    let failedCount = 0;

    for (const [index, row] of rows.entries()) {
      try {
        const platformName = row.platformName ?? defaultPlatformName;
        const providerGameId = importProvider ? row.externalId : null;
        const game = await resolveCatalogGame({
          title: row.title,
          platformName,
          provider: importProvider ?? undefined,
          providerGameId,
          rawData: importProvider ? row.rawData : undefined,
        });

        await prisma.userGameEntry.upsert({
          where: {
            userId_gameId_status: {
              userId,
              gameId: game.id,
              status: row.status,
            },
          },
          update: {
            abandonedAt:
              row.status === UserGameStatus.DROPPED ? new Date() : undefined,
            activeBacklog:
              row.status === UserGameStatus.DROPPED ? false : undefined,
            source: EntrySource.CSV,
            provider: importProvider ?? undefined,
            platformName: platformName ?? undefined,
            playtimeMinutes: row.playtimeMinutes ?? undefined,
            completionPercent: row.completionPercent ?? undefined,
            notes: row.notes ?? undefined,
            rawData: row.rawData as Prisma.InputJsonValue,
          },
          create: {
            userId,
            gameId: game.id,
            status: row.status,
            source: EntrySource.CSV,
            provider: importProvider ?? undefined,
            platformName: platformName ?? undefined,
            abandonedAt:
              row.status === UserGameStatus.DROPPED ? new Date() : undefined,
            activeBacklog:
              row.status === UserGameStatus.DROPPED ? false : undefined,
            playtimeMinutes: row.playtimeMinutes ?? undefined,
            completionPercent: row.completionPercent ?? undefined,
            finishedAt:
              row.status === UserGameStatus.COMPLETED ? new Date() : undefined,
            finishedSource:
              row.status === UserGameStatus.COMPLETED ? "import" : undefined,
            notes: row.notes ?? undefined,
            rawData: row.rawData as Prisma.InputJsonValue,
          },
        });

        await prisma.importRow.create({
          data: {
            jobId: job.id,
            rowIndex: index,
            rawData: row.rawData as Prisma.InputJsonValue,
            normalizedTitle: normalizeTitle(row.title),
            platformName: platformName ?? undefined,
            statusText: row.status,
            playtimeMinutes: row.playtimeMinutes ?? undefined,
            completionPercent: row.completionPercent ?? undefined,
            notes: row.notes ?? undefined,
            externalId: row.externalId ?? undefined,
            outcome: ImportRowStatus.IMPORTED,
            matchedGameId: game.id,
          },
        });

        importedCount += 1;
      } catch (error) {
        failedCount += 1;
        await prisma.importRow.create({
          data: {
            jobId: job.id,
            rowIndex: index,
            rawData: row.rawData as Prisma.InputJsonValue,
            normalizedTitle: normalizeTitle(row.title),
            platformName: row.platformName ?? undefined,
            statusText: row.status,
            playtimeMinutes: row.playtimeMinutes ?? undefined,
            completionPercent: row.completionPercent ?? undefined,
            notes: row.notes ?? undefined,
            externalId: row.externalId ?? undefined,
            outcome: ImportRowStatus.FAILED,
            error:
              error instanceof Error
                ? error.message
                : "Import paused before we could read the error.",
          },
        });
      }
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.COMPLETED,
        completedAt: new Date(),
        summary: {
          importedCount,
          failedCount,
          totalRows: rows.length,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      importedCount,
      failedCount,
      totalRows: rows.length,
    };
  } catch (error) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.FAILED,
        completedAt: new Date(),
        summary: {
          error:
            error instanceof Error
              ? error.message
              : "Import paused before we could read the error.",
        } as Prisma.InputJsonValue,
      },
    });

    throw error;
  }
}

export type ProfileDataScope =
  | "assistant"
  | "games"
  | "calendar"
  | "integrations"
  | "journal"
  | "overview"
  | "playerProfile"
  | "setup";

export async function getPlayTimeBenchmark(userId: string) {
  const entries = await prisma.userGameEntry.findMany({
    where: {
      userId: { not: userId },
      activeBacklog: true,
      abandonedAt: null,
      finishedAt: null,
      status: { notIn: [UserGameStatus.COMPLETED, UserGameStatus.DROPPED, UserGameStatus.WISHLIST] },
    },
    include: { game: true },
  });
  const byUser = new Map<string, typeof entries>();
  for (const entry of entries) {
    const userEntries = byUser.get(entry.userId) ?? [];
    userEntries.push(entry);
    byUser.set(entry.userId, userEntries);
  }
  const totals = [...byUser.values()]
    .map((userEntries) => getBacklogEstimate(userEntries))
    .filter((estimate) => estimate.gamesWithEstimate > 0)
    .map((estimate) => estimate.minutes);

  return {
    averageMinutes: totals.length
      ? Math.round(totals.reduce((sum, minutes) => sum + minutes, 0) / totals.length)
      : null,
    comparedUsers: totals.length,
  };
}

export async function getProfileData(
  userId: string,
  options: { scope?: ProfileDataScope } = {},
) {
  const scope = options.scope ?? "overview";
  const shouldLoadFullGameEntries = scope === "games" || scope === "journal" || scope === "calendar";
  const shouldLoadJournalEntries = scope === "journal" || scope === "calendar";
  const focusedGameEntriesWhere = {
    OR: [
      { currentPlayingSlot: { not: null } },
      { status: UserGameStatus.PLAYING_NEXT },
      { isFavorite: true },
      { status: { not: UserGameStatus.WISHLIST } },
    ],
  } satisfies Prisma.UserGameEntryWhereInput;
  const gameEntriesQuery = {
    include: {
      game: true,
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    ...(shouldLoadFullGameEntries
      ? {}
      : {
          where: focusedGameEntriesWhere,
          take: 80,
        }),
  } satisfies Prisma.UserGameEntryFindManyArgs;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      externalAccounts: {
        orderBy: { createdAt: "asc" },
      },
      gameEntries: gameEntriesQuery,
      journalEntries: {
        include: {
          game: true,
          media: true,
          userGameEntry: {
            include: {
              game: true,
            },
          },
        },
        orderBy: {
          occurredAt: "desc",
        },
        ...(shouldLoadJournalEntries ? {} : { take: 0 }),
      },
      importJobs: {
        include: {
          rows: {
            orderBy: {
              rowIndex: "asc",
            },
            take: 8,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      },
    },
  });

  if (!user) {
    return null;
  }

  const [currentPlayingEntries, playingNextEntries] = await Promise.all([
    prisma.userGameEntry.findMany({
      where: {
        userId,
        currentPlayingSlot: { not: null },
      },
      include: {
        game: true,
      },
      orderBy: [{ currentPlayingSlot: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.userGameEntry.findMany({
      where: {
        userId,
        status: UserGameStatus.PLAYING_NEXT,
        currentPlayingSlot: null,
        finishedAt: null,
      },
      include: {
        game: true,
      },
      orderBy: [{ playingNextSlot: "asc" }, { updatedAt: "desc" }],
      take: 3,
    }),
  ]);
  const gameEntries = [...user.gameEntries];
  const loadedEntryIds = new Set(gameEntries.map((entry) => entry.id));
  for (const entry of [...currentPlayingEntries, ...playingNextEntries]) {
    if (!loadedEntryIds.has(entry.id)) {
      gameEntries.push(entry);
    }
  }
  const profileUser = {
    ...user,
    gameEntries,
  };

  const ownedEntries = gameEntries
    .filter((entry) => entry.status === UserGameStatus.OWNED)
    .sort((left, right) => {
      const playtimeDelta =
        (right.playtimeMinutes ?? 0) - (left.playtimeMinutes ?? 0);
      if (playtimeDelta !== 0) {
        return playtimeDelta;
      }
      return right.updatedAt.getTime() - left.updatedAt.getTime();
    });

  const shelfEntries = gameEntries.filter(
    (entry) => entry.status !== UserGameStatus.WISHLIST,
  );

  const wishlistEntries = gameEntries.filter(
    (entry) => entry.status === UserGameStatus.WISHLIST,
  );

  const favoriteEntries = gameEntries.filter(
    (entry) => entry.isFavorite,
  );

  return {
    user: profileUser,
    ownedEntries,
    shelfEntries,
    wishlistEntries,
    favoriteEntries,
    currentPlayingEntries,
    playingNextEntries,
    recentlyUpdated: ownedEntries.slice(0, 4),
    latestImport: user.importJobs[0] ?? null,
    steamAccount:
      user.externalAccounts.find(
        (account) => account.provider === ExternalProvider.STEAM,
      ) ?? null,
    playStationAccount:
      user.externalAccounts.find(
        (account) => account.provider === ExternalProvider.PLAYSTATION,
      ) ?? null,
    xboxAccount:
      user.externalAccounts.find(
        (account) => account.provider === ExternalProvider.XBOX,
      ) ?? null,
  };
}

const gameDetailInclude = {
  providerLinks: true,
  userReviews: {
    include: {
      user: true,
    },
    orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
  },
  journalEntries: {
    include: {
      media: true,
      user: true,
    },
    orderBy: {
      occurredAt: "desc",
    },
  },
  userEntries: {
    include: {
      user: true,
    },
  },
} satisfies Prisma.GameInclude;

async function enrichMissingGameDetailData(
  game: Prisma.GameGetPayload<{ include: typeof gameDetailInclude }>,
) {
  const searchTitle = cleanGameTitle(game.name);
  let enriched = false;

  try {
    if (!game.igdbId || !game.summary || !game.genres || !game.platforms) {
      const metadata = await igdbAdapter.searchBestMatch({
        title: searchTitle,
      });

      if (metadata) {
        await applyMetadataToExistingGame(game.id, metadata);
        enriched = true;
      }
    }

    if (
      !game.hltbMainStoryMinutes ||
      !game.hltbMainExtraMinutes ||
      !game.hltbCompletionistMinutes
    ) {
      const completionTimes = await hltbAdapter.searchBestMatch({
        title: searchTitle,
      });

      if (completionTimes) {
        await applyCompletionTimesToGame(game.id, completionTimes);
        enriched = true;
      }
    }

    if (game.metacriticScore === null) {
      const steamLink = game.providerLinks.find(
        (link) => link.provider === ExternalProvider.STEAM,
      );
      const reviewScore = await metacriticAdapter.searchBestMatch({
        title: searchTitle,
        steamAppId: steamLink?.providerGameId ?? null,
      });

      if (reviewScore) {
        await applyReviewScoreToGame(game.id, reviewScore);
        enriched = true;
      }
    }
  } catch (error) {
    console.warn("Could not enrich game detail data.", {
      gameId: game.id,
      error,
    });
  }

  return enriched;
}

export async function getGameBySlug(slug: string) {
  const game = await prisma.game.findUnique({
    where: { slug },
    include: gameDetailInclude,
  });

  if (!game) {
    return game;
  }

  const enriched = await enrichMissingGameDetailData(game);
  if (!enriched) {
    return game;
  }

  return prisma.game.findUnique({
    where: { slug },
    include: gameDetailInclude,
  });
}

import {
  ExternalProvider,
  Prisma,
  type GameProviderLink,
} from "@prisma/client";
import { getTitleTrophies, getUserTrophiesEarnedForTitle } from "psn-api";
import { getPlayStationAuthorizationForAccount } from "@/lib/playstation";
import { prisma } from "@/lib/prisma";
import { fetchSteamAchievementCompletion } from "@/lib/steam";
import { fetchXboxAchievementProgressForTitle } from "@/lib/xbox";

export type ProviderProgressRefreshStatus =
  | "refreshed"
  | "unavailable"
  | "failed";

export type ProviderProgressRefreshResult = {
  provider: ExternalProvider | null;
  status: ProviderProgressRefreshStatus;
};

type RefreshableProvider =
  | Extract<ExternalProvider, "STEAM">
  | Extract<ExternalProvider, "PLAYSTATION">
  | Extract<ExternalProvider, "XBOX">;

const refreshableProviders = new Set<ExternalProvider>([
  ExternalProvider.STEAM,
  ExternalProvider.PLAYSTATION,
  ExternalProvider.XBOX,
]);

function isRecord(value: Prisma.JsonValue | null | undefined) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getExistingRawData(value: Prisma.JsonValue | null | undefined) {
  return isRecord(value) ? (value as Prisma.JsonObject) : {};
}

function getProviderCandidates(
  entryProvider: ExternalProvider | null,
  providerLinks: GameProviderLink[],
) {
  const candidates: RefreshableProvider[] = [];

  for (const provider of [
    entryProvider,
    ...providerLinks.map((link) => link.provider),
  ]) {
    if (!provider || !refreshableProviders.has(provider)) {
      continue;
    }

    if (!candidates.includes(provider as RefreshableProvider)) {
      candidates.push(provider as RefreshableProvider);
    }
  }

  return candidates;
}

function readPlayStationTrophyTarget(link: GameProviderLink) {
  const rawData = getExistingRawData(link.rawData);
  const npCommunicationId =
    typeof rawData.npCommunicationId === "string"
      ? rawData.npCommunicationId
      : link.providerGameId.startsWith("npCommunicationId:")
        ? link.providerGameId.slice("npCommunicationId:".length)
        : null;

  if (!npCommunicationId) {
    return null;
  }

  const npServiceName =
    rawData.npServiceName === "trophy" || rawData.npServiceName === "trophy2"
      ? rawData.npServiceName
      : typeof rawData.trophyTitlePlatform === "string" &&
          rawData.trophyTitlePlatform.includes("PS5")
        ? ("trophy2" as const)
        : ("trophy" as const);

  return { npCommunicationId, npServiceName };
}

async function updateEntryProgress({
  completionPercent,
  entryId,
  lastPlayedAt,
  provider,
  rawData,
}: {
  completionPercent: number | null;
  entryId: string;
  lastPlayedAt?: Date | null;
  provider: RefreshableProvider;
  rawData: Prisma.InputJsonValue;
}) {
  const entry = await prisma.userGameEntry.findUnique({
    where: { id: entryId },
    select: { rawData: true },
  });

  await prisma.userGameEntry.update({
    where: { id: entryId },
    data: {
      completionPercent,
      lastPlayedAt: lastPlayedAt ?? undefined,
      rawData: {
        ...getExistingRawData(entry?.rawData),
        providerProgressRefresh: {
          provider,
          refreshedAt: new Date().toISOString(),
          rawData,
        },
      } as Prisma.InputJsonValue,
    },
  });
}

async function refreshSteamProgress({
  entryId,
  link,
  steamId,
}: {
  entryId: string;
  link: GameProviderLink;
  steamId: string;
}) {
  const appId = Number(link.providerGameId);
  if (!Number.isInteger(appId) || appId <= 0) {
    return false;
  }

  const progress = await fetchSteamAchievementCompletion(steamId, appId);
  if (progress.reason === "unavailable") {
    return false;
  }

  await updateEntryProgress({
    completionPercent: progress.completionPercent ?? null,
    entryId,
    provider: ExternalProvider.STEAM,
    rawData: progress as unknown as Prisma.InputJsonValue,
  });

  return true;
}

async function refreshPlayStationProgress({
  authorization,
  entryId,
  link,
}: {
  authorization: { accessToken: string };
  entryId: string;
  link: GameProviderLink;
}) {
  const target = readPlayStationTrophyTarget(link);
  if (!target) {
    return false;
  }

  const [titleTrophies, earnedTrophies] = await Promise.all([
    getTitleTrophies(authorization, target.npCommunicationId, "all", {
      npServiceName: target.npServiceName,
    }),
    getUserTrophiesEarnedForTitle(
      authorization,
      "me",
      target.npCommunicationId,
      "all",
      { npServiceName: target.npServiceName },
    ),
  ]);
  const trophyIds = new Set(
    (titleTrophies.trophies ?? [])
      .filter((trophy) => trophy.trophyType !== "platinum")
      .map((trophy) => String(trophy.trophyId)),
  );

  if (!trophyIds.size) {
    return false;
  }

  const earnedCount = (earnedTrophies.trophies ?? []).filter(
    (trophy) =>
      trophy.earned &&
      trophy.trophyType !== "platinum" &&
      trophyIds.has(String(trophy.trophyId)),
  ).length;
  const completionPercent = Math.max(
    0,
    Math.min(100, Math.round((earnedCount / trophyIds.size) * 100)),
  );

  await updateEntryProgress({
    completionPercent,
    entryId,
    provider: ExternalProvider.PLAYSTATION,
    rawData: {
      earnedTrophies: earnedCount,
      totalTrophies: trophyIds.size,
      target,
    },
  });

  return true;
}

async function refreshXboxProgress({
  accountId,
  entryId,
  links,
}: {
  accountId: string;
  entryId: string;
  links: GameProviderLink[];
}) {
  const account = await prisma.externalAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return false;
  }

  const progress = await fetchXboxAchievementProgressForTitle(
    account,
    links.map((link) => link.providerGameId),
  );

  if (!progress) {
    return false;
  }

  await updateEntryProgress({
    completionPercent: progress.completionPercent ?? null,
    entryId,
    lastPlayedAt: progress.lastPlayedAt,
    provider: ExternalProvider.XBOX,
    rawData: progress.rawData as Prisma.InputJsonValue,
  });

  return true;
}

export async function refreshUserGameEntryProviderProgress({
  entryId,
  userId,
}: {
  entryId: string;
  userId: string;
}): Promise<ProviderProgressRefreshResult> {
  const entry = await prisma.userGameEntry.findFirst({
    where: { id: entryId, userId },
    include: {
      game: {
        include: {
          providerLinks: true,
        },
      },
    },
  });

  if (!entry) {
    return { provider: null, status: "unavailable" };
  }

  const candidates = getProviderCandidates(entry.provider, entry.game.providerLinks);
  let attemptedProvider: RefreshableProvider | null = null;

  for (const provider of candidates) {
    const links = entry.game.providerLinks.filter(
      (link) => link.provider === provider,
    );
    if (!links.length) {
      continue;
    }

    attemptedProvider = provider;

    try {
      if (provider === ExternalProvider.STEAM) {
        const steamAccount = await prisma.externalAccount.findFirst({
          where: { userId, provider: ExternalProvider.STEAM },
        });
        const steamLink = links[0];

        if (
          steamAccount &&
          steamLink &&
          (await refreshSteamProgress({
            entryId,
            link: steamLink,
            steamId: steamAccount.providerAccountId,
          }))
        ) {
          return { provider, status: "refreshed" };
        }
      }

      if (provider === ExternalProvider.PLAYSTATION) {
        const playStationAccount = await prisma.externalAccount.findFirst({
          where: { userId, provider: ExternalProvider.PLAYSTATION },
        });
        const playStationLink = links.find(readPlayStationTrophyTarget);

        if (playStationAccount && playStationLink) {
          const authorization =
            await getPlayStationAuthorizationForAccount(playStationAccount);

          if (
            await refreshPlayStationProgress({
              authorization,
              entryId,
              link: playStationLink,
            })
          ) {
            return { provider, status: "refreshed" };
          }
        }
      }

      if (
        provider === ExternalProvider.XBOX &&
        entry.externalAccountId &&
        (await refreshXboxProgress({
          accountId: entry.externalAccountId,
          entryId,
          links,
        }))
      ) {
        return { provider, status: "refreshed" };
      }
    } catch {
      return { provider, status: "failed" };
    }
  }

  return {
    provider: attemptedProvider,
    status: attemptedProvider ? "failed" : "unavailable",
  };
}

import type { SyncedLibraryGame } from "./providers/contracts.ts";

export type XboxTitleHistoryItem = {
  titleId?: number | string;
  name?: string;
  platform?: string;
  titleType?: string;
  serviceConfigId?: string;
  lastUnlock?: string;
  earnedAchievements?: number;
  currentGamerscore?: number;
  maxGamerscore?: number;
};

export type XboxTitleHubItem = {
  titleId?: string;
  pfn?: string;
  serviceConfigId?: string;
  name?: string;
  displayImage?: string;
  devices?: string[];
  achievement?: {
    currentAchievements?: number;
    totalAchievements?: number;
    currentGamerscore?: number;
    totalGamerscore?: number;
    progressPercentage?: number;
  };
  titleHistory?: {
    lastTimePlayed?: string;
  };
  images?: Array<{
    type?: string;
    url?: string;
  }>;
};

export function parseXboxDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

export function calculateCompletionPercent(input: {
  earnedAchievements?: number | null;
  totalAchievements?: number | null;
  currentGamerscore?: number | null;
  maxGamerscore?: number | null;
  progressPercentage?: number | null;
}) {
  if (typeof input.progressPercentage === "number") {
    return Math.max(0, Math.min(100, Math.round(input.progressPercentage)));
  }

  if (
    typeof input.earnedAchievements === "number" &&
    typeof input.totalAchievements === "number" &&
    input.totalAchievements > 0
  ) {
    return Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (input.earnedAchievements / input.totalAchievements) * 100,
        ),
      ),
    );
  }

  if (
    typeof input.currentGamerscore === "number" &&
    typeof input.maxGamerscore === "number" &&
    input.maxGamerscore > 0
  ) {
    return Math.max(
      0,
      Math.min(
        100,
        Math.round((input.currentGamerscore / input.maxGamerscore) * 100),
      ),
    );
  }

  return null;
}

export function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

export function mapPlatform(value: unknown) {
  if (typeof value !== "string" || !value) {
    return "Xbox";
  }

  if (value.toLowerCase().includes("windows")) {
    return "Xbox / Windows";
  }

  return value;
}

export function pickTitleHubImage(title: XboxTitleHubItem) {
  return (
    title.displayImage ??
    title.images?.find((image) => image.type === "BoxArt")?.url ??
    title.images?.find((image) => image.url)?.url ??
    null
  );
}

export function mergeXboxTitles(
  achievementTitles: XboxTitleHistoryItem[],
  titleHubTitles: XboxTitleHubItem[],
): SyncedLibraryGame[] {
  const merged = new Map<string, SyncedLibraryGame>();

  for (const title of titleHubTitles) {
    const titleId = title.titleId ? String(title.titleId) : null;
    if (!titleId || !title.name) {
      continue;
    }

    const providerGameIds = uniqueValues([
      `titleId:${titleId}`,
      title.serviceConfigId ? `scid:${title.serviceConfigId}` : null,
      title.pfn ? `pfn:${title.pfn}` : null,
    ]);

    merged.set(titleId, {
      providerGameId: providerGameIds[0] ?? `titleId:${titleId}`,
      providerGameIds,
      title: title.name,
      platformName: title.devices?.length ? title.devices.join(", ") : "Xbox",
      completionPercent: calculateCompletionPercent({
        currentGamerscore: title.achievement?.currentGamerscore ?? null,
        earnedAchievements: title.achievement?.currentAchievements ?? null,
        maxGamerscore: title.achievement?.totalGamerscore ?? null,
        progressPercentage: title.achievement?.progressPercentage ?? null,
        totalAchievements: title.achievement?.totalAchievements ?? null,
      }),
      lastPlayedAt: parseXboxDate(title.titleHistory?.lastTimePlayed),
      rawData: {
        syncSource: "xbox-titlehub-history",
        coverUrl: pickTitleHubImage(title),
        title,
      },
    });
  }

  for (const title of achievementTitles) {
    const titleId = title.titleId ? String(title.titleId) : null;
    if (!titleId || !title.name) {
      continue;
    }

    const existing = merged.get(titleId);
    const providerGameIds = uniqueValues([
      existing?.providerGameId,
      ...(existing?.providerGameIds ?? []),
      `titleId:${titleId}`,
      title.serviceConfigId ? `scid:${title.serviceConfigId}` : null,
    ]);
    const completionPercent = calculateCompletionPercent({
      currentGamerscore: title.currentGamerscore ?? null,
      earnedAchievements: title.earnedAchievements ?? null,
      maxGamerscore: title.maxGamerscore ?? null,
    });

    merged.set(titleId, {
      providerGameId: providerGameIds[0] ?? `titleId:${titleId}`,
      providerGameIds,
      title: existing?.title ?? title.name,
      platformName: existing?.platformName ?? mapPlatform(title.platform),
      completionPercent: existing?.completionPercent ?? completionPercent,
      lastPlayedAt: existing?.lastPlayedAt ?? parseXboxDate(title.lastUnlock),
      rawData: {
        syncSource: "xbox-achievement-title-history",
        achievementTitle: title,
        titleHubTitle: existing?.rawData,
      },
    });
  }

  return Array.from(merged.values());
}

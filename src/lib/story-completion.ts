import {
  ExternalProvider,
  UserGameStatus,
  type ExternalAccount,
  type GameProviderLink,
} from "@prisma/client";
import { getTitleTrophies, getUserTrophiesEarnedForTitle } from "psn-api";
import { getPlayStationAuthorizationForAccount } from "@/lib/playstation";
import { prisma } from "@/lib/prisma";
import { getOpenAiConfig } from "@/lib/openai";
import { runWithAiBudget } from "./ai-budget.ts";
import { getAiSettings, type AiSettingsValues } from "./ai-settings.ts";
import {
  classifyStoryAchievementHeuristically,
  type StoryAchievementCandidate,
} from "@/lib/story-achievement-classifier";

// A game counts as finished when the credits roll, not when every achievement
// is unlocked. Platforms do not expose a "story finished" flag, so this module
// finds the one achievement/trophy a game awards when the main story ends and
// checks whether the user unlocked it.

export type StoryCompletionDetectionResult = {
  scannedCount: number;
  finishedCount: number;
  finishedTitles: string[];
};

const STORY_ACHIEVEMENT_CACHE_DAYS = 30;
const DETECTION_CONCURRENCY = 5;

type AiClassification = {
  achievementId: string | null;
};

async function classifyStoryAchievementWithAi(
  gameName: string,
  candidates: StoryAchievementCandidate[],
  userId: string,
  aiSettings: AiSettingsValues,
): Promise<StoryAchievementCandidate | null | undefined> {
  const config = getOpenAiConfig();
  if (!config || candidates.length === 0 || !aiSettings.storyCompletionEnabled) {
    return null;
  }

  try {
    return await runWithAiBudget({
      feature: "story_completion",
      inputSummary: {
        candidateCount: candidates.length,
        gameName,
      },
      model: config.model,
      userId,
      execute: async () => {
        const response = await fetch(`${config.baseUrl}/responses`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: config.model,
            max_output_tokens: aiSettings.storyCompletionMaxOutputTokens,
            input: [
              {
                role: "system",
                content:
                  "You identify which single achievement or trophy a video game awards when the player finishes the main story (when the credits roll). Ignore collectibles, difficulty-only, multiplayer, DLC, and 100%/platinum achievements. Return JSON only.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  game: gameName,
                  instructions:
                    "Return the id of the achievement granted for completing the main story or seeing the credits. If no listed achievement clearly marks story completion, return null.",
                  achievements: candidates.map((candidate) => ({
                    id: candidate.id,
                    name: candidate.name,
                    description: candidate.description ?? null,
                  })),
                }),
              },
            ],
            text: {
              format: {
                type: "json_schema",
                name: "story_achievement",
                strict: true,
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    achievementId: { type: ["string", "null"] },
                  },
                  required: ["achievementId"],
                },
              },
            },
          }),
        });

        if (!response.ok) {
          return undefined;
        }

        const json = (await response.json()) as {
          output_text?: string;
          output?: Array<{ content?: Array<{ text?: string }> }>;
        };
        const outputText =
          json.output_text ??
          json.output
            ?.flatMap((item) => item.content ?? [])
            .find((content) => typeof content.text === "string")?.text;
        if (!outputText) {
          return undefined;
        }

        const parsed = JSON.parse(outputText) as AiClassification;
        if (!parsed.achievementId) {
          return null;
        }

        return (
          candidates.find((candidate) => candidate.id === parsed.achievementId) ??
          null
        );
      },
    });
  } catch {
    return undefined;
  }
}

type StoryAchievementResolution = {
  id: string;
  name: string;
  source: "ai" | "heuristic";
} | null;

function isStoryCacheFresh(link: GameProviderLink) {
  if (!link.storyAchievementCheckedAt) {
    return false;
  }

  const ageMs = Date.now() - link.storyAchievementCheckedAt.getTime();
  return ageMs < STORY_ACHIEVEMENT_CACHE_DAYS * 24 * 60 * 60 * 1000;
}

async function resolveStoryAchievementForLink(
  link: GameProviderLink,
  gameName: string,
  fetchCandidates: () => Promise<StoryAchievementCandidate[]>,
  userId: string,
  aiClassificationBudget: { remaining: number },
  aiSettings: AiSettingsValues,
): Promise<StoryAchievementResolution> {
  if (isStoryCacheFresh(link)) {
    if (link.storyAchievementId) {
      return {
        id: link.storyAchievementId,
        name: link.storyAchievementName ?? link.storyAchievementId,
        source:
          link.storyAchievementSource === "ai" ? "ai" : "heuristic",
      };
    }
    // Cached "none": the game has no detectable story achievement.
    return null;
  }

  const candidates = await fetchCandidates();
  const heuristicPick = classifyStoryAchievementHeuristically(candidates);
  let pick = heuristicPick;
  let source: "ai" | "heuristic" = "heuristic";
  let attemptedAi = false;
  const canUseAi =
    aiSettings.storyCompletionEnabled && Boolean(getOpenAiConfig());

  if (!pick && canUseAi && aiClassificationBudget.remaining > 0) {
    aiClassificationBudget.remaining -= 1;
    attemptedAi = true;
    const aiPick = await classifyStoryAchievementWithAi(
      gameName,
      candidates,
      userId,
      aiSettings,
    );
    if (aiPick === undefined) {
      return null;
    }
    pick = aiPick;
    source = "ai";
  }

  if (!pick && !attemptedAi && aiClassificationBudget.remaining <= 0) {
    return null;
  }

  await prisma.gameProviderLink.update({
    where: { id: link.id },
    data: {
      storyAchievementId: pick?.id ?? null,
      storyAchievementName: pick?.name ?? null,
      storyAchievementSource: pick ? source : "none",
      storyAchievementCheckedAt: new Date(),
    },
  });

  return pick ? { id: pick.id, name: pick.name, source } : null;
}

// --- Steam ---

type SteamSchemaResponse = {
  game?: {
    availableGameStats?: {
      achievements?: Array<{
        name: string;
        displayName?: string;
        description?: string;
      }>;
    };
  };
};

type SteamPlayerAchievementsResponse = {
  playerstats?: {
    success?: boolean;
    achievements?: Array<{
      apiname: string;
      achieved: number;
      unlocktime?: number;
    }>;
  };
};

async function fetchSteamAchievementSchema(
  apiKey: string,
  appId: string,
): Promise<StoryAchievementCandidate[]> {
  const url = new URL(
    "https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/",
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("appid", appId);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as SteamSchemaResponse;
  return (data.game?.availableGameStats?.achievements ?? []).map(
    (achievement) => ({
      id: achievement.name,
      name: achievement.displayName ?? achievement.name,
      description: achievement.description ?? null,
    }),
  );
}

async function fetchSteamUnlock(
  apiKey: string,
  steamId: string,
  appId: string,
  achievementId: string,
): Promise<{ unlocked: boolean; unlockedAt: Date | null }> {
  const url = new URL(
    "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/",
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamid", steamId);
  url.searchParams.set("appid", appId);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return { unlocked: false, unlockedAt: null };
  }

  const data = (await response.json()) as SteamPlayerAchievementsResponse;
  const achievement = data.playerstats?.achievements?.find(
    (item) => item.apiname === achievementId,
  );

  if (!achievement || achievement.achieved !== 1) {
    return { unlocked: false, unlockedAt: null };
  }

  return {
    unlocked: true,
    unlockedAt: achievement.unlocktime
      ? new Date(achievement.unlocktime * 1000)
      : null,
  };
}

// --- PlayStation ---

function readPlayStationTrophyTarget(link: GameProviderLink) {
  const rawData =
    link.rawData && typeof link.rawData === "object"
      ? (link.rawData as Record<string, unknown>)
      : {};
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

async function fetchPlayStationTrophyCandidates(
  authorization: { accessToken: string },
  target: { npCommunicationId: string; npServiceName: "trophy" | "trophy2" },
): Promise<StoryAchievementCandidate[]> {
  const response = await getTitleTrophies(
    authorization,
    target.npCommunicationId,
    "all",
    { npServiceName: target.npServiceName },
  );

  return (response.trophies ?? [])
    .filter((trophy) => trophy.trophyType !== "platinum")
    .map((trophy) => ({
      id: String(trophy.trophyId),
      name: trophy.trophyName ?? `Trophy ${trophy.trophyId}`,
      description: trophy.trophyDetail ?? null,
    }));
}

async function fetchPlayStationUnlock(
  authorization: { accessToken: string },
  target: { npCommunicationId: string; npServiceName: "trophy" | "trophy2" },
  trophyId: string,
): Promise<{ unlocked: boolean; unlockedAt: Date | null }> {
  const response = await getUserTrophiesEarnedForTitle(
    authorization,
    "me",
    target.npCommunicationId,
    "all",
    { npServiceName: target.npServiceName },
  );

  const trophy = (response.trophies ?? []).find(
    (item) => String(item.trophyId) === trophyId,
  );

  if (!trophy?.earned) {
    return { unlocked: false, unlockedAt: null };
  }

  return {
    unlocked: true,
    unlockedAt: trophy.earnedDateTime ? new Date(trophy.earnedDateTime) : null,
  };
}

// --- Detection run ---

type DetectionEntry = Awaited<
  ReturnType<typeof loadDetectionEntries>
>[number];

async function loadDetectionEntries(userId: string) {
  return prisma.userGameEntry.findMany({
    where: {
      userId,
      finishedAt: null,
      status: {
        notIn: [UserGameStatus.COMPLETED, UserGameStatus.WISHLIST],
      },
    },
    include: {
      game: {
        include: {
          providerLinks: true,
        },
      },
    },
  });
}

async function markEntryFinished(
  entryId: string,
  unlockedAt: Date | null,
) {
  await prisma.userGameEntry.update({
    where: { id: entryId },
    data: {
      finishedAt: unlockedAt ?? new Date(),
      finishedSource: "story_achievement",
    },
  });
}

async function detectEntryViaSteam(
  entry: DetectionEntry,
  steamAccount: ExternalAccount,
  apiKey: string,
  resolveMemo: Map<string, Promise<StoryAchievementResolution>>,
  aiClassificationBudget: { remaining: number },
  userId: string,
  aiSettings: AiSettingsValues,
) {
  const link = entry.game.providerLinks.find(
    (candidate) => candidate.provider === ExternalProvider.STEAM,
  );
  if (!link) {
    return false;
  }

  let resolution = resolveMemo.get(link.id);
  if (!resolution) {
    resolution = resolveStoryAchievementForLink(
      link,
      entry.game.name,
      () => fetchSteamAchievementSchema(apiKey, link.providerGameId),
      userId,
      aiClassificationBudget,
      aiSettings,
    );
    resolveMemo.set(link.id, resolution);
  }

  const storyAchievement = await resolution;
  if (!storyAchievement) {
    return false;
  }

  const unlock = await fetchSteamUnlock(
    apiKey,
    steamAccount.providerAccountId,
    link.providerGameId,
    storyAchievement.id,
  );
  if (!unlock.unlocked) {
    return false;
  }

  await markEntryFinished(entry.id, unlock.unlockedAt);
  return true;
}

async function detectEntryViaPlayStation(
  entry: DetectionEntry,
  authorization: { accessToken: string },
  resolveMemo: Map<string, Promise<StoryAchievementResolution>>,
  aiClassificationBudget: { remaining: number },
  userId: string,
  aiSettings: AiSettingsValues,
) {
  const link = entry.game.providerLinks.find(
    (candidate) =>
      candidate.provider === ExternalProvider.PLAYSTATION &&
      readPlayStationTrophyTarget(candidate),
  );
  if (!link) {
    return false;
  }

  const target = readPlayStationTrophyTarget(link);
  if (!target) {
    return false;
  }

  let resolution = resolveMemo.get(link.id);
  if (!resolution) {
    resolution = resolveStoryAchievementForLink(
      link,
      entry.game.name,
      () => fetchPlayStationTrophyCandidates(authorization, target),
      userId,
      aiClassificationBudget,
      aiSettings,
    );
    resolveMemo.set(link.id, resolution);
  }

  const storyAchievement = await resolution;
  if (!storyAchievement) {
    return false;
  }

  const unlock = await fetchPlayStationUnlock(
    authorization,
    target,
    storyAchievement.id,
  );
  if (!unlock.unlocked) {
    return false;
  }

  await markEntryFinished(entry.id, unlock.unlockedAt);
  return true;
}

/**
 * Scans the user's unfinished entries and marks the ones whose story-
 * completion achievement is unlocked. Best-effort: providers that are not
 * connected (or games with no detectable story achievement) are skipped.
 * Xbox is not supported yet because its per-title achievement schema needs a
 * separate scid-based endpoint.
 */
export async function detectFinishedGamesForUser(
  userId: string,
): Promise<StoryCompletionDetectionResult> {
  const [entries, steamAccount, playStationAccount, aiSettings] = await Promise.all([
    loadDetectionEntries(userId),
    prisma.externalAccount.findFirst({
      where: { userId, provider: ExternalProvider.STEAM },
    }),
    prisma.externalAccount.findFirst({
      where: { userId, provider: ExternalProvider.PLAYSTATION },
    }),
    getAiSettings(),
  ]);

  const steamApiKey = process.env.STEAM_API_KEY;
  let playStationAuthorization: { accessToken: string } | null = null;
  if (playStationAccount) {
    try {
      playStationAuthorization =
        await getPlayStationAuthorizationForAccount(playStationAccount);
    } catch {
      playStationAuthorization = null;
    }
  }

  const resolveMemo = new Map<string, Promise<StoryAchievementResolution>>();
  const aiClassificationBudget = {
    remaining: aiSettings.storyCompletionMaxClassificationsPerRun,
  };
  const finishedTitles: string[] = [];
  let scannedCount = 0;

  for (
    let index = 0;
    index < entries.length;
    index += DETECTION_CONCURRENCY
  ) {
    const batch = entries.slice(index, index + DETECTION_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (entry) => {
        try {
          if (steamAccount && steamApiKey) {
            const finished = await detectEntryViaSteam(
              entry,
              steamAccount,
              steamApiKey,
              resolveMemo,
              aiClassificationBudget,
              userId,
              aiSettings,
            );
            if (finished) {
              return { entry, finished: true, scanned: true };
            }
          }

          if (playStationAuthorization) {
            const finished = await detectEntryViaPlayStation(
              entry,
              playStationAuthorization,
              resolveMemo,
              aiClassificationBudget,
              userId,
              aiSettings,
            );
            if (finished) {
              return { entry, finished: true, scanned: true };
            }
          }

          return { entry, finished: false, scanned: true };
        } catch {
          return { entry, finished: false, scanned: false };
        }
      }),
    );

    for (const result of results) {
      if (result.scanned) {
        scannedCount += 1;
      }
      if (result.finished) {
        finishedTitles.push(result.entry.game.name);
      }
    }
  }

  return {
    scannedCount,
    finishedCount: finishedTitles.length,
    finishedTitles,
  };
}

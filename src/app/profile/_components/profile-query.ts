import { AssistantSignalType, GameCompletionModel, UserGameStatus } from "@prisma/client";
import { getEffectiveGameCompletionModel } from "../../../lib/game-completion-model.ts";
import { normalizePlatformNames } from "../../../lib/platform-names.ts";
import { createTranslator, type Locale } from "../../../lib/i18n.ts";
import type { ProfileEntry, ProfileTab, StatusMessage } from "./profile-types";

export const UNKNOWN_PLATFORM_FILTER = "__unknown";

export type ProfileSearchParams = Promise<{
  tab?: string;
  step?: string;
  entryId?: string;
  view?: string;
  sort?: string;
  signal?: string;
  status?: string;
  viewAs?: string;
  platform?: string;
  structure?: string;
  includeDormant?: string;
  q?: string;
  month?: string;
  connected?: string;
  synced?: string;
  imported?: string;
  photoImported?: string;
  disconnected?: string;
  login?: string;
  playstation?: string;
  playstationSynced?: string;
  xbox?: string;
  xboxSynced?: string;
  assistant?: string;
  playerProfile?: string;
  currentPlaying?: string;
  playingNext?: string;
  finishedDetected?: string;
  finishedScanned?: string;
  manualAdded?: string;
  reviewsSynced?: string;
  journal?: string;
  onboarding?: string;
  syncPending?: string;
  error?: string;
}>;

export type SetupStep = "rhythm" | "platforms";

export function parseSetupStep(value: string | undefined): SetupStep {
  if (value === "platforms") {
    return value;
  }

  return "rhythm";
}

export function parseAssistantSignal(value: string | undefined) {
  return Object.values(AssistantSignalType).includes(value as AssistantSignalType)
    ? (value as AssistantSignalType)
    : null;
}

export function parseActiveStatus(value: string | undefined) {
  return Object.values(UserGameStatus).includes(value as UserGameStatus)
    ? (value as UserGameStatus)
    : null;
}

export const COMPLETION_MODEL_FILTERS = Object.values(GameCompletionModel);

export function parseActiveCompletionModel(value: string | undefined) {
  return Object.values(GameCompletionModel).includes(value as GameCompletionModel)
    ? (value as GameCompletionModel)
    : null;
}

export function parseActiveTab(value: string | undefined): ProfileTab {
  if (value === "games") {
    return "games";
  }

  if (value === "journal" || value === "diary") {
    return "journal";
  }

  if (value === "calendar") {
    return "calendar";
  }

  if (
    value === "player-profile" ||
    value === "playerProfile" ||
    value === "profile"
  ) {
    return "playerProfile";
  }

  if (value === "integrations" || value === "sources") {
    return "integrations";
  }

  if (value === "assistant" || value === "coach") {
    return "assistant";
  }

  if (value === "setup") {
    return "setup";
  }

  return "overview";
}

export function getStatusMessage(
  locale: Locale,
  query: Awaited<ProfileSearchParams>,
): StatusMessage {
  const t = createTranslator(locale);

  if (query.error) {
    return { tone: "error", message: query.error };
  }

  if (query.syncPending) {
    return {
      tone: "info",
      message: t("statusMessage.syncAlreadyRunning"),
    };
  }

  if (query.synced) {
    return {
      tone: "success",
      message: t("statusMessage.steamRefreshed", { count: query.synced }),
    };
  }

  if (query.login === "created") {
    return {
      tone: "success",
      message: t("statusMessage.profileCreated"),
    };
  }

  if (query.login === "signed-in") {
    return {
      tone: "success",
      message: t("statusMessage.signedIn"),
    };
  }

  if (query.login === "google") {
    return {
      tone: "success",
      message: t("statusMessage.googleConnected"),
    };
  }

  if (query.disconnected) {
    return {
      tone: "success",
      message: t("statusMessage.sourceDisconnected"),
    };
  }

  if (query.playstationSynced) {
    return {
      tone: "success",
      message: t("statusMessage.playstationRefreshed", {
        count: query.playstationSynced,
      }),
    };
  }

  if (query.xboxSynced) {
    return {
      tone: "success",
      message: t("statusMessage.xboxRefreshed", { count: query.xboxSynced }),
    };
  }

  if (query.finishedDetected) {
    return {
      tone: "success",
      message: t("statusMessage.finishedCheck", {
        scanned: query.finishedScanned ?? t("common.your"),
        count: query.finishedDetected,
      }),
    };
  }

  if (query.imported) {
    return {
      tone: "success",
      message: t("statusMessage.csvImported", { count: query.imported }),
    };
  }

  if (query.photoImported) {
    return {
      tone: "success",
      message: t("statusMessage.photoImported", { count: query.photoImported }),
    };
  }

  if (query.manualAdded) {
    return {
      tone: "success",
      message: t("statusMessage.manualAdded"),
    };
  }

  if (query.reviewsSynced) {
    return {
      tone: "success",
      message: t("statusMessage.reviewsSynced", { count: query.reviewsSynced }),
    };
  }

  if (query.journal === "saved") {
    return {
      tone: "success",
      message: t("statusMessage.journalSaved"),
    };
  }

  if (query.journal === "deleted") {
    return {
      tone: "success",
      message: t("statusMessage.journalDeleted"),
    };
  }

  if (query.onboarding === "updated") {
    return {
      tone: "success",
      message: t("statusMessage.onboardingUpdated"),
    };
  }

  if (query.onboarding === "skipped") {
    return {
      tone: "success",
      message: t("statusMessage.onboardingSkipped"),
    };
  }

  if (query.onboarding === "cleared") {
    return {
      tone: "success",
      message: t("statusMessage.onboardingCleared"),
    };
  }

  if (query.currentPlaying === "updated") {
    return {
      tone: "success",
      message: t("statusMessage.currentPlayingUpdated"),
    };
  }

  if (query.currentPlaying === "cleared") {
    return {
      tone: "success",
      message: t("statusMessage.currentPlayingCleared"),
    };
  }

  if (query.playingNext === "updated") {
    return {
      tone: "success",
      message: t("statusMessage.playingNextUpdated"),
    };
  }

  if (query.playingNext === "cleared") {
    return {
      tone: "success",
      message: t("statusMessage.playingNextCleared"),
    };
  }

  if (
    query.connected ||
    query.playstation === "connected" ||
    query.xbox === "connected"
  ) {
    return {
      tone: "success",
      message: t("statusMessage.sourceConnected"),
    };
  }

  if (query.assistant) {
    return {
      tone: "success",
      message: t("statusMessage.guideRefreshed", { count: query.assistant }),
    };
  }

  if (query.playerProfile === "updated") {
    return {
      tone: "success",
      message: t("statusMessage.playerProfileUpdated"),
    };
  }

  if (query.playerProfile === "empty") {
    return {
      tone: "error",
      message: t("statusMessage.playerProfileEmpty"),
    };
  }

  return null;
}

export function getUserPlatformLabels(entry: ProfileEntry) {
  const platforms = normalizePlatformNames(entry.platformName);
  if (platforms.length) {
    return platforms;
  }

  if (entry.provider === "STEAM") {
    return ["Steam"];
  }

  if (entry.provider === "PLAYSTATION") {
    return ["PlayStation"];
  }

  if (entry.provider === "XBOX") {
    return ["Xbox"];
  }

  return [];
}

export function getUserPlatformLabel(entry: ProfileEntry) {
  return getUserPlatformLabels(entry).join(", ") || null;
}

export function getPlatformFilterOptions(entries: ProfileEntry[]) {
  return [...new Set(entries.flatMap((entry) => {
    const labels = getUserPlatformLabels(entry);
    return labels.length ? labels : [UNKNOWN_PLATFORM_FILTER];
  }))].sort((left, right) => {
    if (left === UNKNOWN_PLATFORM_FILTER) return 1;
    if (right === UNKNOWN_PLATFORM_FILTER) return -1;
    return left.localeCompare(right, "en", { numeric: true });
  });
}

export function isDormantEntry(entry: ProfileEntry) {
  return (
    entry.status === UserGameStatus.DROPPED ||
    entry.activeBacklog === false
  );
}

export function filterEntries({
  activePlatform,
  activeCompletionModel,
  activeStatus,
  entries,
  includeDormant,
  queryText,
  signalEntryIds,
}: {
  activePlatform: string | null;
  activeCompletionModel: GameCompletionModel | null;
  activeStatus: string | null;
  entries: ProfileEntry[];
  includeDormant: boolean;
  queryText: string;
  signalEntryIds: Set<string> | null;
}) {
  const normalizedQuery = queryText.trim().toLowerCase();
  const selectedPlatforms = normalizePlatformNames(activePlatform);

  return entries.filter((entry) => {
    if (signalEntryIds && !signalEntryIds.has(entry.id)) {
      return false;
    }

    if (!includeDormant && isDormantEntry(entry)) {
      return false;
    }

    if (activeStatus && entry.status !== activeStatus) {
      return false;
    }

    if (
      activeCompletionModel &&
      getEffectiveGameCompletionModel(entry.game) !== activeCompletionModel
    ) {
      return false;
    }

    if (activePlatform) {
      const platformLabels = getUserPlatformLabels(entry);
      if (activePlatform === UNKNOWN_PLATFORM_FILTER) {
        if (platformLabels.length) {
          return false;
        }
      } else if (!selectedPlatforms.some((platform) => platformLabels.includes(platform))) {
        return false;
      }
    }

    if (!normalizedQuery) {
      return true;
    }

    return [entry.game.name, entry.platformName, ...getUserPlatformLabels(entry)]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedQuery));
  });
}

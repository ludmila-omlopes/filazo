import { AssistantSignalType, UserGameStatus } from "@prisma/client";
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
  platform?: string;
  includeDormant?: string;
  q?: string;
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

export function parseActiveTab(value: string | undefined): ProfileTab {
  if (value === "games") {
    return "games";
  }

  if (value === "journal" || value === "diary") {
    return "journal";
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

export function getUserPlatformLabel(entry: ProfileEntry) {
  const platformName = entry.platformName?.trim();
  if (platformName) {
    return platformName;
  }

  if (entry.provider === "STEAM") {
    return "Steam";
  }

  if (entry.provider === "PLAYSTATION") {
    return "PlayStation";
  }

  if (entry.provider === "XBOX") {
    return "Xbox";
  }

  return null;
}

export function isNotStartedEntry(entry: ProfileEntry) {
  if (
    entry.status !== UserGameStatus.OWNED &&
    entry.status !== UserGameStatus.BACKLOG
  ) {
    return false;
  }

  return (
    !entry.finishedAt &&
    !entry.startedAt &&
    !entry.lastPlayedAt &&
    !entry.currentPlayingSlot &&
    !entry.playingNextSlot &&
    (entry.playtimeMinutes ?? 0) <= 0 &&
    (entry.completionPercent ?? 0) <= 0
  );
}

export function isDormantEntry(entry: ProfileEntry) {
  return (
    entry.status === UserGameStatus.DROPPED ||
    entry.activeBacklog === false ||
    isNotStartedEntry(entry)
  );
}

export function filterEntries({
  activePlatform,
  activeStatus,
  entries,
  includeDormant,
  queryText,
  signalEntryIds,
}: {
  activePlatform: string | null;
  activeStatus: string | null;
  entries: ProfileEntry[];
  includeDormant: boolean;
  queryText: string;
  signalEntryIds: Set<string> | null;
}) {
  const normalizedQuery = queryText.trim().toLowerCase();

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

    if (activePlatform) {
      const platformLabel = getUserPlatformLabel(entry);
      if (activePlatform === UNKNOWN_PLATFORM_FILTER) {
        if (platformLabel) {
          return false;
        }
      } else if (platformLabel !== activePlatform) {
        return false;
      }
    }

    if (!normalizedQuery) {
      return true;
    }

    return [entry.game.name, getUserPlatformLabel(entry)]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedQuery));
  });
}

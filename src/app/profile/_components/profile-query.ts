import { AssistantSignalType, UserGameStatus } from "@prisma/client";
import { createTranslator, type Locale } from "@/lib/i18n";
import type { ProfileEntry, ProfileTab, StatusMessage } from "./profile-types";

export type ProfileSearchParams = Promise<{
  tab?: string;
  view?: string;
  sort?: string;
  signal?: string;
  status?: string;
  platform?: string;
  q?: string;
  connected?: string;
  synced?: string;
  imported?: string;
  disconnected?: string;
  login?: string;
  playstation?: string;
  playstationSynced?: string;
  xbox?: string;
  xboxSynced?: string;
  assistant?: string;
  playerProfile?: string;
  currentPlaying?: string;
  finishedDetected?: string;
  finishedScanned?: string;
  error?: string;
}>;

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

  if (value === "integrations" || value === "sources") {
    return "integrations";
  }

  if (value === "assistant" || value === "coach") {
    return "assistant";
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
        scanned: query.finishedScanned ?? "your",
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

export function filterEntries({
  activePlatform,
  activeStatus,
  entries,
  queryText,
  signalEntryIds,
}: {
  activePlatform: string | null;
  activeStatus: string | null;
  entries: ProfileEntry[];
  queryText: string;
  signalEntryIds: Set<string> | null;
}) {
  const normalizedQuery = queryText.trim().toLowerCase();

  return entries.filter((entry) => {
    if (signalEntryIds && !signalEntryIds.has(entry.id)) {
      return false;
    }

    if (activeStatus && entry.status !== activeStatus) {
      return false;
    }

    if (activePlatform && entry.platformName !== activePlatform) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [entry.game.name, entry.platformName]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedQuery));
  });
}

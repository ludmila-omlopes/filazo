import { AssistantSignalType, UserGameStatus } from "@prisma/client";
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
  query: Awaited<ProfileSearchParams>,
): StatusMessage {
  if (query.error) {
    return { tone: "error", message: query.error };
  }

  if (query.synced) {
    return {
      tone: "success",
      message: `Steam refreshed. ${query.synced} games updated.`,
    };
  }

  if (query.login === "created") {
    return {
      tone: "success",
      message: "Profile created. Add games whenever you are ready.",
    };
  }

  if (query.login === "signed-in") {
    return {
      tone: "success",
      message: "Signed in. Your catalog is ready.",
    };
  }

  if (query.login === "google") {
    return {
      tone: "success",
      message: "Google login connected. Your catalog is ready.",
    };
  }

  if (query.disconnected) {
    return {
      tone: "success",
      message: "Source disconnected. Existing games stayed on your shelf.",
    };
  }

  if (query.playstationSynced) {
    return {
      tone: "success",
      message: `PlayStation refreshed. ${query.playstationSynced} games updated.`,
    };
  }

  if (query.xboxSynced) {
    return {
      tone: "success",
      message: `Xbox refreshed. ${query.xboxSynced} games updated.`,
    };
  }

  if (query.finishedDetected) {
    return {
      tone: "success",
      message: `Finished-game check looked at ${
        query.finishedScanned ?? "your"
      } entries and found ${query.finishedDetected} finished games.`,
    };
  }

  if (query.imported) {
    return {
      tone: "success",
      message: `CSV import finished. ${query.imported} games were added or updated.`,
    };
  }

  if (query.photoImported) {
    return {
      tone: "success",
      message: `Photo import finished. ${query.photoImported} games were added or updated.`,
    };
  }

  if (query.manualAdded) {
    return {
      tone: "success",
      message: "Game added. You can adjust it from your catalog whenever you want.",
    };
  }

  if (query.reviewsSynced) {
    return {
      tone: "success",
      message: `Review sync finished. ${query.reviewsSynced} reviews were added or updated.`,
    };
  }

  if (query.journal === "saved") {
    return {
      tone: "success",
      message: "Diary page saved.",
    };
  }

  if (query.onboarding === "updated") {
    return {
      tone: "success",
      message: "Setup preferences saved. You can revisit them from the Setup tab.",
    };
  }

  if (query.onboarding === "skipped") {
    return {
      tone: "success",
      message: "Onboarding skipped. The profile stays open and editable.",
    };
  }

  if (query.onboarding === "cleared") {
    return {
      tone: "success",
      message: "Setup choices cleared. Start again whenever you are ready.",
    };
  }

  if (query.currentPlaying === "updated") {
    return {
      tone: "success",
      message: "Current playing updated. Your overview now reflects your picks.",
    };
  }

  if (query.currentPlaying === "cleared") {
    return {
      tone: "success",
      message: "Current playing cleared. Suggested picks are ready whenever you want them.",
    };
  }

  if (
    query.connected ||
    query.playstation === "connected" ||
    query.xbox === "connected"
  ) {
    return {
      tone: "success",
      message: "Source connected. Refresh it whenever you are ready.",
    };
  }

  if (query.assistant) {
    return {
      tone: "success",
      message: `Guide refreshed. ${query.assistant} suggestions updated.`,
    };
  }

  if (query.playerProfile === "updated") {
    return {
      tone: "success",
      message:
        "Player profile refreshed from your games, feedback, and reviews.",
    };
  }

  if (query.playerProfile === "empty") {
    return {
      tone: "error",
      message:
        "Your shelf is quiet right now. Add a few games before asking for a player profile.",
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

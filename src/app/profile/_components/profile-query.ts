import { AssistantSignalType, UserGameStatus } from "@prisma/client";
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

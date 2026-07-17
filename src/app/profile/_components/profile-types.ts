import type { AssistantSignalType } from "@prisma/client";
import type {
  getAssistantProfileData,
} from "@/lib/assistant/queries";
import type { getPlayerProfileForUser } from "@/lib/assistant/profile-agent";
import type { getProfileData } from "@/lib/catalog";

export type ProfileData = NonNullable<
  Awaited<ReturnType<typeof getProfileData>>
>;

export type ProfileEntry = ProfileData["ownedEntries"][number];

export type AssistantData = Awaited<ReturnType<typeof getAssistantProfileData>>;

export type PlayerProfileData = Awaited<
  ReturnType<typeof getPlayerProfileForUser>
>;

export type ProfileTab =
  | "overview"
  | "integrations"
  | "games"
  | "calendar"
  | "journal"
  | "playerProfile"
  | "assistant"
  | "setup";

export type StatusMessage = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

export type ShelfFilters = {
  activeSignal: AssistantSignalType | null;
  activeStatus: string | null;
  activePlatform: string | null;
  includeDormant: boolean;
  queryText: string;
};

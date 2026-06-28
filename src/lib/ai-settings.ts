import type { AiSettings } from "@prisma/client";
import { prisma } from "./prisma.ts";
import type { AiBudgetFeature } from "./ai-budget.ts";

export const AI_SETTINGS_ID = "default";

export type AiSettingsValues = Omit<AiSettings, "id" | "createdAt" | "updatedAt">;

export const AI_SETTINGS_LIMITS = {
  assistantPlayNextMaxOutputTokens: { min: 100, max: 4000 },
  assistantSummaryMaxOutputTokens: { min: 100, max: 4000 },
  chatBudgetUnits: { min: 1, max: 20 },
  chatMaxOutputTokens: { min: 100, max: 4000 },
  chatMaxSteps: { min: 1, max: 10 },
  globalDailyLimit: { min: 0, max: 100000 },
  photoImportMaxCandidates: { min: 1, max: 100 },
  photoImportMaxFileBytes: { min: 100000, max: 20000000 },
  photoImportMaxFiles: { min: 1, max: 10 },
  photoImportMaxOutputTokens: { min: 100, max: 4000 },
  playerProfileMaxCalls: { min: 1, max: 10 },
  playerProfileMaxOutputTokens: { min: 200, max: 6000 },
  storyCompletionMaxClassificationsPerRun: { min: 0, max: 100 },
  storyCompletionMaxOutputTokens: { min: 50, max: 2000 },
  userDailyLimit: { min: 0, max: 100000 },
  voiceMaxFileBytes: { min: 100000, max: 50000000 },
  voiceRecordingMaxSeconds: { min: 10, max: 900 },
  voiceTranslationMaxOutputTokens: { min: 100, max: 4000 },
} as const satisfies Record<keyof NumericAiSettings, { min: number; max: number }>;

type NumericAiSettings = Pick<
  AiSettingsValues,
  | "assistantPlayNextMaxOutputTokens"
  | "assistantSummaryMaxOutputTokens"
  | "chatBudgetUnits"
  | "chatMaxOutputTokens"
  | "chatMaxSteps"
  | "globalDailyLimit"
  | "photoImportMaxCandidates"
  | "photoImportMaxFileBytes"
  | "photoImportMaxFiles"
  | "photoImportMaxOutputTokens"
  | "playerProfileMaxCalls"
  | "playerProfileMaxOutputTokens"
  | "storyCompletionMaxClassificationsPerRun"
  | "storyCompletionMaxOutputTokens"
  | "userDailyLimit"
  | "voiceMaxFileBytes"
  | "voiceRecordingMaxSeconds"
  | "voiceTranslationMaxOutputTokens"
>;

function readNonNegativeIntegerEnv(name: string, fallback: number) {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export const DEFAULT_AI_SETTINGS: AiSettingsValues = {
  assistantChatEnabled: true,
  assistantPlayNextEnabled: true,
  assistantSummaryEnabled: true,
  playerProfileEnabled: true,
  photoImportEnabled: true,
  voiceTranscriptionEnabled: true,
  voiceTranslationEnabled: true,
  storyCompletionEnabled: true,
  userDailyLimit: readNonNegativeIntegerEnv("AI_USER_DAILY_LIMIT", 20),
  globalDailyLimit: readNonNegativeIntegerEnv("AI_GLOBAL_DAILY_LIMIT", 100),
  chatBudgetUnits: 3,
  chatMaxSteps: 3,
  chatMaxOutputTokens: 700,
  assistantPlayNextMaxOutputTokens: 900,
  assistantSummaryMaxOutputTokens: 650,
  playerProfileMaxCalls: 3,
  playerProfileMaxOutputTokens: 1400,
  photoImportMaxFiles: 2,
  photoImportMaxFileBytes: 4 * 1024 * 1024,
  photoImportMaxOutputTokens: 1000,
  photoImportMaxCandidates: 30,
  voiceMaxFileBytes: 10 * 1024 * 1024,
  voiceRecordingMaxSeconds: 180,
  voiceTranslationMaxOutputTokens: 900,
  storyCompletionMaxClassificationsPerRun: 10,
  storyCompletionMaxOutputTokens: 220,
};

const BOOLEAN_AI_SETTINGS = [
  "assistantChatEnabled",
  "assistantPlayNextEnabled",
  "assistantSummaryEnabled",
  "playerProfileEnabled",
  "photoImportEnabled",
  "voiceTranscriptionEnabled",
  "voiceTranslationEnabled",
  "storyCompletionEnabled",
] as const satisfies ReadonlyArray<keyof AiSettingsValues>;

function clampInteger(
  key: keyof NumericAiSettings,
  value: unknown,
  fallback: number,
) {
  const limits = AI_SETTINGS_LIMITS[key];
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(limits.max, Math.max(limits.min, parsed));
}

export function normalizeAiSettings(
  input: Partial<AiSettingsValues> | null | undefined,
): AiSettingsValues {
  const normalized = { ...DEFAULT_AI_SETTINGS };

  for (const key of BOOLEAN_AI_SETTINGS) {
    if (typeof input?.[key] === "boolean") {
      normalized[key] = input[key];
    }
  }

  for (const key of Object.keys(AI_SETTINGS_LIMITS) as Array<
    keyof NumericAiSettings
  >) {
    normalized[key] = clampInteger(key, input?.[key], DEFAULT_AI_SETTINGS[key]);
  }

  return normalized;
}

export async function getAiSettings() {
  const settings = await prisma.aiSettings.findUnique({
    where: { id: AI_SETTINGS_ID },
  });

  return normalizeAiSettings(settings);
}

export async function saveAiSettings(input: AiSettingsValues) {
  const data = normalizeAiSettings(input);

  return prisma.aiSettings.upsert({
    where: { id: AI_SETTINGS_ID },
    update: data,
    create: {
      id: AI_SETTINGS_ID,
      ...data,
    },
  });
}

export function isAiFeatureEnabled(
  settings: AiSettingsValues,
  feature: AiBudgetFeature,
) {
  switch (feature) {
    case "assistant_chat":
      return settings.assistantChatEnabled;
    case "assistant_play_next":
      return settings.assistantPlayNextEnabled;
    case "assistant_summary":
      return settings.assistantSummaryEnabled;
    case "photo_import":
      return settings.photoImportEnabled;
    case "player_profile":
      return settings.playerProfileEnabled;
    case "story_completion":
      return settings.storyCompletionEnabled;
    case "voice_transcription":
      return settings.voiceTranscriptionEnabled;
    case "voice_translation":
      return settings.voiceTranslationEnabled;
  }
}

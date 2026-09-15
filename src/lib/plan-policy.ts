import { hasProAccess, type PlanAccount } from "./account-plans.ts";

const MIB = 1024 * 1024;

function positiveEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function getPlanLimits(user: PlanAccount | null | undefined) {
  const pro = hasProAccess(user);
  return {
    pro,
    calendar: pro,
    automaticSync: pro,
    webSearch: pro,
    retrospective: pro,
    journalStorageBytes: positiveEnv(pro ? "PRO_JOURNAL_STORAGE_MIB" : "FREE_JOURNAL_STORAGE_MIB", pro ? 1024 : 100) * MIB,
    chatDailyTokenLimit: positiveEnv(pro ? "PRO_CHAT_DAILY_TOKENS" : "FREE_CHAT_DAILY_TOKENS", pro ? 20000 : 5000),
    voiceTranscriptionDailyCallLimit: positiveEnv(pro ? "PRO_VOICE_DAILY_CALLS" : "FREE_VOICE_DAILY_CALLS", pro ? 10 : 1),
  };
}

export function applyPlanAiLimits<T extends { chatDailyTokenLimit: number; voiceTranscriptionDailyCallLimit: number }>(settings: T, user: PlanAccount | null | undefined): T {
  const limits = getPlanLimits(user);
  // Administrator limits remain ceilings, including zero to disable a feature.
  return { ...settings,
    chatDailyTokenLimit: Math.min(settings.chatDailyTokenLimit, limits.chatDailyTokenLimit),
    voiceTranscriptionDailyCallLimit: Math.min(settings.voiceTranscriptionDailyCallLimit, limits.voiceTranscriptionDailyCallLimit),
  };
}

export function canAddJournalMedia(used: number, added: number, limit: number) {
  return Number.isSafeInteger(used) && Number.isSafeInteger(added) &&
    used >= 0 && added >= 0 && (added === 0 || used + added <= limit);
}

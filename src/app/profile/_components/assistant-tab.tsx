import { BacklogDiagnosis } from "@/components/assistant/backlog-diagnosis";
import { BuyDecisionForm } from "@/components/assistant/buy-decision-form";
import { LibraryChat } from "@/components/assistant/library-chat";
import { PlayNextPanel } from "@/components/assistant/play-next-panel";
import { PlayerProfilePanel } from "@/components/assistant/player-profile-panel";
import { SyncActionForm } from "@/components/sync-action-form";
import { SectionHeader } from "@/components/ui/section-header";
import { createTranslator, type Locale } from "@/lib/i18n";
import type { AiSettingsValues } from "@/lib/ai-settings";
import { isAiProviderConfigured } from "@/lib/openai";
import { formatNumber } from "@/lib/utils";
import {
  generatePlayerProfileAction,
  refreshAssistantInsightsAction,
} from "../assistant-actions";
import type {
  AssistantData,
  PlayerProfileData,
  ProfileData,
} from "./profile-types";

function formatUsd(value: number) {
  return new Intl.NumberFormat(undefined, {
    currency: "USD",
    maximumFractionDigits: value < 0.01 ? 4 : 2,
    minimumFractionDigits: value < 0.01 ? 4 : 2,
    style: "currency",
  }).format(value);
}

function formatAssistantCooldown(
  seconds: number,
  t: ReturnType<typeof createTranslator>,
) {
  if (seconds <= 0) {
    return t("assistant.tab.availableNow");
  }

  const minutes = Math.ceil(seconds / 60);
  return minutes === 1
    ? t("assistant.tab.inOneMinute")
    : t("assistant.tab.inMinutes", { count: minutes });
}

export function PlayerProfileTab({
  aiSettings,
  locale,
  playerProfile,
  profile,
}: {
  aiSettings: AiSettingsValues;
  locale: Locale;
  playerProfile: PlayerProfileData;
  profile: ProfileData;
}) {
  return (
    <section className="grid gap-5 rounded-card border border-edge bg-dusk-lavender-soft p-6 shadow-rest">
      <PlayerProfilePanel
        action={generatePlayerProfileAction}
        aiConfigured={
          isAiProviderConfigured() &&
          aiSettings.playerProfileEnabled
        }
        hasGames={
          profile.ownedEntries.length + profile.wishlistEntries.length > 0
        }
        locale={locale}
        profile={playerProfile}
      />
    </section>
  );
}

export function AssistantTab({
  assistant,
  locale,
}: {
  assistant: AssistantData;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  if (!assistant) {
    return null;
  }

  return (
    <>
      <section className="flex items-center justify-between gap-4 rounded-card border border-edge bg-dusk-lavender-soft px-6 py-5 shadow-rest max-md:flex-col max-md:items-start">
        <div>
          <p className="section-label !mb-1">{t("assistant.tab.label")}</p>
          <p className="text-sm font-semibold leading-snug">
            {t("assistant.tab.refreshHelp")}
          </p>
          <details className="mt-3 text-xs font-semibold text-ink-soft">
            <summary className="cursor-pointer">{t("assistant.tab.usage")}</summary>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-pill bg-surface px-3 py-1">
                {t("assistant.tab.availableToday")}{" "}
                {formatUsd(assistant.aiUsage.spendRemainingToday)}
              </span>
              <span className="rounded-pill bg-surface px-3 py-1">
                {t("assistant.tab.usedToday")}{" "}
                {formatUsd(assistant.aiUsage.spendUsedToday)} /{" "}
                {formatUsd(assistant.aiUsage.userDailySpendLimitUsd)}
              </span>
              <span className="rounded-pill bg-surface px-3 py-1">
                {t("assistant.tab.chatRemaining", {
                  count: formatNumber(
                    assistant.aiUsage.chatRemainingTokensToday,
                    locale,
                  ),
                })}
              </span>
              <span className="rounded-pill bg-surface px-3 py-1">
                {t("assistant.tab.nextRefresh")}{" "}
                {assistant.aiUsage.openAiConfigured
                  ? formatAssistantCooldown(
                      assistant.aiUsage.cooldownRemainingSeconds,
                      t,
                    )
                  : t("assistant.tab.unavailable")}
              </span>
            </div>
          </details>
        </div>
        <SyncActionForm
          action={refreshAssistantInsightsAction}
          buttonLabel={t("assistant.tab.refresh")}
          pendingLabel={t("assistant.tab.refresh")}
          pendingNotice={t("assistant.tab.refreshHelp")}
        />
      </section>

      <LibraryChat
        aiConfigured={
          assistant.aiUsage.openAiConfigured &&
          assistant.aiUsage.assistantChatEnabled
        }
      />
      <BacklogDiagnosis assistant={assistant} locale={locale} />
      <PlayNextPanel assistant={assistant} locale={locale} />

      <section className="panel">
        <SectionHeader
          eyebrow={t("assistant.buy.eyebrow")}
          title={t("assistant.buy.title")}
        />
        <BuyDecisionForm />
      </section>
    </>
  );
}

import { BacklogDiagnosis } from "@/components/assistant/backlog-diagnosis";
import { BuyDecisionForm } from "@/components/assistant/buy-decision-form";
import { LibraryChat } from "@/components/assistant/library-chat";
import { PlayNextPanel } from "@/components/assistant/play-next-panel";
import { PlayerProfilePanel } from "@/components/assistant/player-profile-panel";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import Link from "next/link";
import { createTranslator, type Locale } from "@/lib/i18n";
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

export function AssistantCorner({
  locale,
  playerProfile,
  profile,
}: {
  locale: Locale;
  playerProfile: PlayerProfileData;
  profile: ProfileData;
}) {
  const t = createTranslator(locale);
  return (
    <section className="grid gap-5 rounded-card border border-edge bg-dusk-lavender-soft p-6 shadow-rest">
      <SectionHeader
        eyebrow={t("assistant.corner.eyebrow")}
        title={t("assistant.corner.title")}
        aside={
          <Button asChild size="sm" variant="ghost">
            <Link href="/tonight">{t("assistant.corner.openTonight")}</Link>
          </Button>
        }
      />
      <PlayerProfilePanel
        action={generatePlayerProfileAction}
        aiConfigured={Boolean(process.env.OPENAI_API_KEY)}
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
                {formatNumber(assistant.aiUsage.effectiveRemainingToday)}
              </span>
              <span className="rounded-pill bg-surface px-3 py-1">
                {t("assistant.tab.usedToday")} {formatNumber(assistant.aiUsage.userUsedToday)} /{" "}
                {formatNumber(assistant.aiUsage.userDailyLimit)}
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
        <form action={refreshAssistantInsightsAction}>
          <Button type="submit">{t("assistant.tab.refresh")}</Button>
        </form>
      </section>

      <LibraryChat aiConfigured={Boolean(process.env.OPENAI_API_KEY)} />
      <BacklogDiagnosis assistant={assistant} />
      <PlayNextPanel assistant={assistant} />

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

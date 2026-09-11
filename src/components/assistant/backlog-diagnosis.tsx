import Link from "next/link";
import { AssistantSignalType } from "@prisma/client";
import type { AssistantProfileData } from "@/lib/assistant/queries";
import { createTranslator, type Locale } from "@/lib/i18n";
import { getAssistantSignalDisplayLabel } from "@/lib/copy";
import { formatNumber } from "@/lib/utils";

export function BacklogDiagnosis({
  assistant,
  locale,
}: {
  assistant: NonNullable<AssistantProfileData>;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const counts = new Map<AssistantSignalType, number>();
  for (const insight of assistant.insights) {
    counts.set(insight.signalType, (counts.get(insight.signalType) ?? 0) + 1);
  }

  const items = [
    [getAssistantSignalDisplayLabel(AssistantSignalType.UNTOUCHED, locale), AssistantSignalType.UNTOUCHED],
    [getAssistantSignalDisplayLabel(AssistantSignalType.SAMPLED_DROPPED, locale), AssistantSignalType.SAMPLED_DROPPED],
    [getAssistantSignalDisplayLabel(AssistantSignalType.STALE_PLAYING, locale), AssistantSignalType.STALE_PLAYING],
    [getAssistantSignalDisplayLabel(AssistantSignalType.FINISHABLE_SOON, locale), AssistantSignalType.FINISHABLE_SOON],
    [getAssistantSignalDisplayLabel(AssistantSignalType.FINISH_BEFORE_RELEASE, locale), AssistantSignalType.FINISH_BEFORE_RELEASE],
    [getAssistantSignalDisplayLabel(AssistantSignalType.RISKY_TO_START_BEFORE_RELEASE, locale), AssistantSignalType.RISKY_TO_START_BEFORE_RELEASE],
    [getAssistantSignalDisplayLabel(AssistantSignalType.UPCOMING_RELEASE_WATCH, locale), AssistantSignalType.UPCOMING_RELEASE_WATCH],
    [getAssistantSignalDisplayLabel(AssistantSignalType.LIKELY_FINISHED, locale), AssistantSignalType.LIKELY_FINISHED],
    [getAssistantSignalDisplayLabel(AssistantSignalType.WISHLIST_RISK, locale), AssistantSignalType.WISHLIST_RISK],
  ] as const;

  return (
    <details className="rounded-card border border-edge bg-surface/60 p-5 max-sm:p-4">
      <summary className="cursor-pointer rounded-inner text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage">
        {t("assistant.diagnosis.eyebrow")}
      </summary>
      <div className="mt-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg">{t("assistant.diagnosis.title")}</h3>
          <p className="text-xs text-ink-soft">
            {assistant.latestRun
              ? t("assistant.diagnosis.lastRun", {
                  date: assistant.latestRun.createdAt.toLocaleDateString(locale),
                })
              : t("assistant.diagnosis.notRefreshed")}
          </p>
        </div>

      <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        {items.map(([label, signal]) => (
          <Link
            className="flex items-center justify-between gap-3 rounded-inner border border-edge bg-canvas p-3 transition-colors hover:bg-sage-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-soft"
            href={`/profile?tab=games&view=list&signal=${signal}`}
            key={signal}
          >
            <strong className="order-2 text-sm font-medium tabular-nums">
              {formatNumber(counts.get(signal) ?? 0)}
            </strong>
            <span className="text-sm text-ink-soft">
              {label}
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        {t("assistant.diagnosis.summary", {
          ownedCount: formatNumber(assistant.librarySummary.ownedCount, locale),
          untouchedCount: formatNumber(
            assistant.librarySummary.untouchedCount,
            locale,
          ),
          sampledDroppedCount: formatNumber(
            assistant.librarySummary.sampledDroppedCount,
            locale,
          ),
        })}
      </p>
      </div>
    </details>
  );
}

import Link from "next/link";
import { AssistantSignalType } from "@prisma/client";
import type { AssistantProfileData } from "@/lib/assistant/queries";
import { SectionHeader } from "@/components/ui/section-header";
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
    <section className="panel">
      <SectionHeader
        eyebrow={t("assistant.diagnosis.eyebrow")}
        title={t("assistant.diagnosis.title")}
        aside={
          <div className="pill">
            {assistant.latestRun
              ? t("assistant.diagnosis.lastRun", {
                  date: assistant.latestRun.createdAt.toLocaleDateString(locale),
                })
              : t("assistant.diagnosis.notRefreshed")}
          </div>
        }
      />

      <div className="grid grid-cols-6 gap-3 max-lg:grid-cols-3 max-sm:grid-cols-2">
        {items.map(([label, signal]) => (
          <Link
            className="rounded-inner border border-edge bg-canvas p-4 text-center transition-[background-color,box-shadow] hover:bg-sage-soft hover:shadow-rest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-soft motion-safe:transition-[transform,background-color,box-shadow] motion-safe:hover:-translate-y-0.5"
            href={`/profile?tab=games&view=list&signal=${signal}`}
            key={signal}
          >
            <strong className="block font-display text-2xl font-medium">
              {formatNumber(counts.get(signal) ?? 0)}
            </strong>
            <span className="mt-1.5 block text-caption font-bold text-ink-soft">
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
    </section>
  );
}

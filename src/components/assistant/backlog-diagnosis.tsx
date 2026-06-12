import Link from "next/link";
import { AssistantSignalType } from "@prisma/client";
import type { AssistantProfileData } from "@/lib/assistant/queries";
import { SectionHeader } from "@/components/ui/section-header";
import { getAssistantSignalDisplayLabel } from "@/lib/copy";
import { formatNumber } from "@/lib/utils";

export function BacklogDiagnosis({
  assistant,
}: {
  assistant: NonNullable<AssistantProfileData>;
}) {
  const counts = new Map<AssistantSignalType, number>();
  for (const insight of assistant.insights) {
    counts.set(insight.signalType, (counts.get(insight.signalType) ?? 0) + 1);
  }

  const items = [
    [getAssistantSignalDisplayLabel(AssistantSignalType.UNTOUCHED), AssistantSignalType.UNTOUCHED],
    [getAssistantSignalDisplayLabel(AssistantSignalType.SAMPLED_DROPPED), AssistantSignalType.SAMPLED_DROPPED],
    [getAssistantSignalDisplayLabel(AssistantSignalType.STALE_PLAYING), AssistantSignalType.STALE_PLAYING],
    [getAssistantSignalDisplayLabel(AssistantSignalType.FINISHABLE_SOON), AssistantSignalType.FINISHABLE_SOON],
    [getAssistantSignalDisplayLabel(AssistantSignalType.LIKELY_FINISHED), AssistantSignalType.LIKELY_FINISHED],
    [getAssistantSignalDisplayLabel(AssistantSignalType.WISHLIST_RISK), AssistantSignalType.WISHLIST_RISK],
  ] as const;

  return (
    <section className="panel">
      <SectionHeader
        eyebrow="A gentle shelf check"
        title="Where your games are resting"
        aside={
          <div className="pill">
            {assistant.latestRun
              ? `Last run: ${assistant.latestRun.createdAt.toLocaleDateString()}`
              : "Not refreshed yet"}
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
            <span className="mt-1.5 block text-caption font-bold tracking-wide text-ink-soft">
              {label}
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        Based on {formatNumber(assistant.librarySummary.ownedCount)} owned games,
        {` ${formatNumber(assistant.librarySummary.untouchedCount)} games ready when you are, `}
        and {formatNumber(assistant.librarySummary.sampledDroppedCount)} short samples.
        Every one of them can wait — that&apos;s what libraries are for.
      </p>
    </section>
  );
}

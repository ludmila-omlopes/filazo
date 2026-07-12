import { Clock3 } from "lucide-react";
import { createTranslator, type Locale } from "@/lib/i18n";
import { getBacklogEstimate } from "@/lib/play-planning";
import type { ProfileData } from "./profile-types";

export function BacklogEstimate({ benchmark, entries, locale }: {
  benchmark: { averageMinutes: number | null; comparedUsers: number } | null;
  entries: ProfileData["user"]["gameEntries"];
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const estimate = getBacklogEstimate(entries);
  const averageMinutes = benchmark?.averageMinutes ?? null;
  const scaleMax = averageMinutes === null ? estimate.minutes : Math.max(estimate.minutes, averageMinutes) * 1.08;
  const ownPosition = scaleMax > 0 ? Math.min(100, estimate.minutes / scaleMax * 100) : 0;
  const averagePosition = scaleMax > 0 && averageMinutes !== null ? Math.min(100, averageMinutes / scaleMax * 100) : 0;
  const comparison = averageMinutes === null ? null : estimate.minutes === averageMinutes
    ? "profile.backlogEstimate.averageEqual" as const
    : estimate.minutes < averageMinutes
      ? "profile.backlogEstimate.averageBelow" as const
      : "profile.backlogEstimate.averageAbove" as const;
  return (
    <section className="rounded-card border border-edge bg-surface p-5 shadow-rest" aria-labelledby="backlog-estimate-title">
      <div className="flex items-start gap-3">
        <Clock3 className="mt-1 size-5 text-glow-strong" aria-hidden />
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">{t("profile.backlogEstimate.kicker")}</p>
          <h2 id="backlog-estimate-title" className="mt-1 font-display text-xl font-medium">
            {estimate.gamesWithEstimate
              ? t("profile.backlogEstimate.value", { hours: Math.round(estimate.minutes / 60) })
              : t("profile.backlogEstimate.empty")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {estimate.gamesWithEstimate
              ? t(estimate.isPartial ? "profile.backlogEstimate.partial" : "profile.backlogEstimate.body", { count: estimate.gamesWithEstimate })
              : t("profile.backlogEstimate.emptyBody")}
          </p>
          {estimate.gamesWithEstimate && averageMinutes !== null && comparison ? (
            <div className="mt-5" aria-label={t(comparison)}>
              <div className="relative h-3 overflow-visible rounded-pill bg-canvas">
                <div className="h-3 rounded-pill bg-glow transition-[width]" style={{ width: `${ownPosition}%` }} />
                <span className="absolute top-[-5px] h-5 w-0.5 bg-ink" style={{ left: `${averagePosition}%` }} aria-hidden />
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-ink-soft">
                <span>{t("profile.backlogEstimate.you", { hours: Math.round(estimate.minutes / 60) })}</span>
                <span>{t("profile.backlogEstimate.average", { hours: Math.round(averageMinutes / 60) })}</span>
              </div>
              <p className="mt-2 text-xs font-semibold text-ink-soft">{t(comparison, { count: benchmark?.comparedUsers ?? 0 })}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

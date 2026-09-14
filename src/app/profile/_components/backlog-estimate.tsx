import { Clock3 } from "lucide-react";
import { createTranslator, type Locale } from "@/lib/i18n";
import { getBacklogEstimate } from "@/lib/play-planning";
import type { ProfileData } from "./profile-types";

export function BacklogEstimate({ entries, locale }: {
  entries: ProfileData["user"]["gameEntries"];
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const estimate = getBacklogEstimate(entries);
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
        </div>
      </div>
    </section>
  );
}

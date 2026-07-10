"use client";

import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setFilazoThemeMode } from "@/app/theme-actions";
import { cn } from "@/lib/utils";
import {
  FILAZO_PHASES,
  phaseFromHour,
  type FilazoPhase,
  type FilazoThemeMode,
} from "@/lib/theme";
import { useTranslations } from "./locale-provider";

/**
 * Theme selector: a slider across the five day phases (each selectable as a
 * fixed background) plus a clock button that hands control back to automatic
 * time-of-day cycling.
 */
export function ThemeToggle({ mode }: { mode: FilazoThemeMode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticMode, setOptimisticMode] = useState<FilazoThemeMode>(mode);
  const [now, setNow] = useState(() => new Date());
  const t = useTranslations();

  useEffect(() => {
    setOptimisticMode(mode);
  }, [mode]);

  const isAuto = optimisticMode === "auto";

  // In auto, keep the slider thumb tracking the current phase as time passes.
  useEffect(() => {
    if (!isAuto) {
      return;
    }
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [isAuto]);

  const activePhase: FilazoPhase = isAuto
    ? phaseFromHour(now.getHours())
    : optimisticMode;
  const sliderIndex = FILAZO_PHASES.indexOf(activePhase);
  const phaseLabel = t(
    `theme.phase.${activePhase}` as Parameters<typeof t>[0],
  );

  function chooseMode(nextMode: FilazoThemeMode) {
    if (nextMode === optimisticMode || isPending) {
      return;
    }

    setOptimisticMode(nextMode);
    startTransition(async () => {
      await setFilazoThemeMode(nextMode);
      router.refresh();
    });
  }

  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-pill border border-edge bg-surface px-3 py-1.5 shadow-rest"
      aria-label={t("theme.label")}
      role="group"
    >
      <input
        type="range"
        min={0}
        max={FILAZO_PHASES.length - 1}
        step={1}
        value={sliderIndex}
        onChange={(event) =>
          chooseMode(FILAZO_PHASES[Number(event.target.value)])
        }
        disabled={isPending}
        aria-label={t("theme.phaseSliderLabel")}
        aria-valuetext={phaseLabel}
        className={cn("phase-slider w-28", isAuto && "opacity-60")}
      />
      <span
        className="w-[9ch] text-caption font-semibold capitalize text-ink-soft"
        suppressHydrationWarning
      >
        {isAuto ? t("theme.auto") : phaseLabel}
      </span>
      <button
        aria-label={t("theme.autoLabel")}
        aria-pressed={isAuto}
        className={cn(
          "grid h-8 w-8 cursor-pointer place-items-center rounded-pill transition-[background-color,box-shadow,color,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70",
          isAuto
            ? "bg-ink text-surface shadow-rest"
            : "text-ink-soft hover:bg-sage-soft hover:text-ink",
        )}
        disabled={isPending}
        onClick={() => chooseMode("auto")}
        title={t("theme.autoLabel")}
        type="button"
      >
        <Clock className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

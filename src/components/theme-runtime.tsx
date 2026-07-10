"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import {
  phaseForMode,
  phaseFromHour,
  themeForPhase,
  type FilazoThemeMode,
} from "@/lib/theme";
import { useTranslations } from "./locale-provider";

function applyMode(mode: FilazoThemeMode) {
  const root = document.documentElement;
  const phase = phaseForMode(mode, new Date().getHours());
  root.dataset.theme = themeForPhase(phase);
  root.dataset.phase = phase;
}

/**
 * Keeps <html data-theme/data-phase> in sync with the chosen mode. In "auto"
 * it re-resolves the visitor's local time of day on a timer and on refocus, so
 * the global background drifts through the day without a reload. Renders
 * nothing — a pre-paint inline script handles the very first frame.
 */
export function ThemeRuntime({ mode }: { mode: FilazoThemeMode }) {
  useEffect(() => {
    applyMode(mode);
    if (mode !== "auto") {
      return;
    }
    const tick = () => applyMode("auto");
    const id = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [mode]);

  return null;
}

/** "5:00 pm · dusk" chip. Only shown in auto mode, where the clock matters. */
export function PhaseBadge({
  mode,
  locale,
}: {
  mode: FilazoThemeMode;
  locale: Locale;
}) {
  const t = useTranslations();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (mode !== "auto") {
    return null;
  }

  const phase = phaseFromHour(now.getHours());
  const time = now.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-pill border border-edge bg-surface/70 px-2.5 py-1 font-mono text-[0.72rem] font-semibold text-ink-soft backdrop-blur-sm max-sm:hidden"
      suppressHydrationWarning
      title={t("theme.autoLabel")}
    >
      <Clock aria-hidden className="h-3.5 w-3.5" />
      {time} · {t(`theme.phase.${phase}` as Parameters<typeof t>[0])}
    </span>
  );
}

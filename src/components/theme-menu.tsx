"use client";

import { Clock, Moon, MoonStar, Sun, Sunrise, Sunset } from "lucide-react";
import { Popover } from "radix-ui";
import type { FilazoPhase, FilazoThemeMode } from "@/lib/theme";
import { useTranslations } from "./locale-provider";
import { ThemeToggle } from "./theme-toggle";

const phaseIcons: Record<FilazoPhase, typeof Sun> = {
  morning: Sunrise,
  afternoon: Sun,
  dusk: Sunset,
  evening: MoonStar,
  night: Moon,
};

/**
 * Compact entry point for the page-light setting: one icon in the header that
 * opens the time-of-day slider, so a rarely changed preference does not
 * compete with navigation.
 */
export function ThemeMenu({ mode }: { mode: FilazoThemeMode }) {
  const t = useTranslations();
  // "auto" depends on the visitor's clock, which the server cannot know, so it
  // shows a clock instead of a guessed phase.
  const Icon = mode === "auto" ? Clock : phaseIcons[mode];
  const current =
    mode === "auto"
      ? t("theme.auto")
      : t(`theme.phase.${mode}` as Parameters<typeof t>[0]);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          aria-label={t("theme.openMenu", { current })}
          className="grid h-10 w-10 cursor-pointer place-items-center rounded-pill border border-edge bg-surface text-ink-soft shadow-rest transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 data-[state=open]:text-ink"
          title={t("theme.openMenu", { current })}
          type="button"
        >
          <Icon aria-hidden className="h-4.5 w-4.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          className="z-50 grid gap-2 rounded-card border border-edge bg-surface p-3 text-ink shadow-float"
          sideOffset={8}
        >
          <p className="px-1 text-caption font-bold uppercase tracking-[0.12em] text-ink-soft">
            {t("theme.phaseSliderLabel")}
          </p>
          <ThemeToggle mode={mode} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

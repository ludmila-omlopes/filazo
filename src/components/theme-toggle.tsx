"use client";

import { Clock, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setFilazoThemeMode } from "@/app/theme-actions";
import { cn } from "@/lib/utils";
import type { FilazoThemeMode } from "@/lib/theme";
import { useTranslations } from "./locale-provider";

type ThemeOption = {
  value: FilazoThemeMode;
  labelKey: "theme.dayLabel" | "theme.nightLabel" | "theme.autoLabel";
  icon: typeof Sun;
};

const themeOptions: ThemeOption[] = [
  { value: "day", labelKey: "theme.dayLabel", icon: Sun },
  { value: "auto", labelKey: "theme.autoLabel", icon: Clock },
  { value: "night", labelKey: "theme.nightLabel", icon: Moon },
];

export function ThemeToggle({ mode }: { mode: FilazoThemeMode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticMode, setOptimisticMode] = useState(mode);
  const t = useTranslations();

  useEffect(() => {
    setOptimisticMode(mode);
  }, [mode]);

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
      className="inline-flex items-center gap-1 rounded-pill border border-edge bg-surface p-1 shadow-rest"
      aria-label={t("theme.label")}
      role="group"
    >
      {themeOptions.map(({ value, labelKey, icon: Icon }) => {
        const isActive = optimisticMode === value;
        const label = t(labelKey);

        return (
          <button
            aria-label={label}
            aria-pressed={isActive}
            className={cn(
              "grid h-8 w-8 cursor-pointer place-items-center rounded-pill transition-[background-color,box-shadow,color,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70",
              isActive
                ? "bg-ink text-surface shadow-rest"
                : "text-ink-soft hover:bg-sage-soft hover:text-ink",
            )}
            disabled={isPending}
            key={value}
            onClick={() => chooseMode(value)}
            title={label}
            type="button"
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setFilazoTheme } from "@/app/theme-actions";
import { cn } from "@/lib/utils";
import type { FilazoTheme } from "@/lib/theme";

type ThemeOption = {
  value: FilazoTheme;
  label: string;
  icon: typeof Sun;
};

const themeOptions: ThemeOption[] = [
  {
    value: "day",
    label: "Day — plan your shelf",
    icon: Sun,
  },
  {
    value: "night",
    label: "Night — pick something to play",
    icon: Moon,
  },
];

export function ThemeToggle({ theme }: { theme: FilazoTheme }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticTheme, setOptimisticTheme] = useState(theme);

  useEffect(() => {
    setOptimisticTheme(theme);
  }, [theme]);

  function chooseTheme(nextTheme: FilazoTheme) {
    if (nextTheme === optimisticTheme || isPending) {
      return;
    }

    setOptimisticTheme(nextTheme);
    startTransition(async () => {
      await setFilazoTheme(nextTheme);
      router.refresh();
    });
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-pill border border-edge bg-surface p-1 shadow-rest"
      aria-label="Theme"
      role="group"
    >
      {themeOptions.map(({ value, label, icon: Icon }) => {
        const isActive = optimisticTheme === value;

        return (
          <button
            aria-label={label}
            aria-pressed={isActive}
            className={cn(
              "grid h-8 w-8 cursor-pointer place-items-center rounded-pill transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70",
              isActive
                ? "bg-ink text-surface shadow-rest"
                : "text-ink-soft hover:bg-sage-soft hover:text-ink",
            )}
            disabled={isPending}
            key={value}
            onClick={() => chooseTheme(value)}
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

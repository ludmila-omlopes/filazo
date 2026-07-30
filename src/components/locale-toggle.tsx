"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setFilazoLocale } from "@/app/locale-actions";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import { useTranslations } from "./locale-provider";

const localeOptions: Locale[] = ["en", "pt-BR"];

export function LocaleToggle({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations();

  function chooseLocale(nextLocale: Locale) {
    if (nextLocale === locale || isPending) {
      return;
    }

    startTransition(async () => {
      await setFilazoLocale(nextLocale);
      router.refresh();
    });
  }

  return (
    <div
      aria-label={t("locale.label")}
      className="inline-flex items-center gap-1 rounded-pill border border-edge bg-surface p-1 shadow-rest"
      role="group"
    >
      {localeOptions.map((option) => {
        const isActive = option === locale;

        return (
          <button
            aria-label={
              option === "en"
                ? t("locale.english")
                : t("locale.portugueseBrazil")
            }
            aria-pressed={isActive}
            className={cn(
              "rounded-pill px-2.5 py-1 text-[0.72rem] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70",
              isActive
                ? "bg-ink text-surface"
                : "text-ink-soft hover:bg-sage-soft hover:text-ink",
            )}
            disabled={isPending}
            key={option}
            onClick={() => chooseLocale(option)}
            type="button"
          >
            {t(`locale.${option}` as const)}
          </button>
        );
      })}
    </div>
  );
}

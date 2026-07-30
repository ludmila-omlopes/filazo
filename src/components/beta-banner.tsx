"use client";

import { useTranslations } from "@/components/locale-provider";

export function BetaBanner() {
  const t = useTranslations();

  return (
    <div className="beta-banner fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-x-2 gap-y-1 border-b border-edge bg-surface/95 px-4 text-sm backdrop-blur-md max-sm:text-xs">
      <p className="text-center font-semibold leading-tight">
        {t("banner.beta.message")}
      </p>
    </div>
  );
}

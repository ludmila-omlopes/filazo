"use client";

import { useTranslations } from "@/components/locale-provider";

export function BetaBanner() {
  const t = useTranslations();

  return (
    <div className="beta-banner fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-x-2 gap-y-1 border-b border-edge bg-surface/95 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] text-sm backdrop-blur-md max-lg:text-xs">
      <p className="text-center font-semibold leading-tight">
        {t("banner.beta.message")}
      </p>
    </div>
  );
}

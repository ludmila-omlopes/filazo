import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createTranslator, type Locale } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils";
import type { ProfileData } from "./profile-types";

function getGreetingLine(locale: Locale) {
  const hour = new Date().getHours();
  const t = createTranslator(locale);

  if (hour < 12) {
    return t("profile.greeting.morning");
  }

  if (hour < 18) {
    return t("profile.greeting.afternoon");
  }

  return t("profile.greeting.evening");
}

export function GreetingStrip({
  locale,
  profile,
}: {
  locale: Locale;
  profile: ProfileData;
}) {
  const connectedCount = profile.user.externalAccounts.length;
  const t = createTranslator(locale);

  return (
    <section className="panel bg-sky-soft/70">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="section-label">{t("profile.greeting.label")}</p>
          <h2 className="text-page-title leading-tight">
            {profile.user.displayName ?? t("common.player")}
          </h2>
          <p className="mt-2 max-w-[52ch] leading-relaxed text-ink-soft">
            {t("profile.greeting.body", {
              greeting: getGreetingLine(locale),
              count: formatNumber(profile.user.gameEntries.length, locale),
            })}
          </p>
          <p className="mt-2 text-sm font-semibold text-ink-soft">
            {connectedCount
              ? connectedCount === 1
                ? t("profile.greeting.connectedOne")
                : t("profile.greeting.connectedMany", {
                    count: formatNumber(connectedCount, locale),
                  })
              : t("profile.greeting.connectedNone")}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-3 max-md:justify-start">
          <Button asChild>
            <Link href="/tonight">{t("profile.greeting.pickTonight")}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/profile?tab=games">{t("profile.greeting.browseShelf")}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/profile?tab=integrations">{t("common.addGames")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

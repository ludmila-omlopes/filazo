import { CsvImportWidget } from "@/components/csv-import-widget";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { createTranslator, type Locale } from "@/lib/i18n";
import { formatDate, formatNumber } from "@/lib/utils";
import {
  importCsvAction,
} from "../actions";
import type { ProfileData } from "./profile-types";

export function AddGamesPanel({
  locale,
  profile,
}: {
  locale: Locale;
  profile: ProfileData;
}) {
  const t = createTranslator(locale);

  return (
    <section className="panel bg-sand-soft/55">
      <SectionHeader
        eyebrow={t("profile.addGames.label")}
        title={t("profile.addGames.title")}
        aside={
          <div className="pill">
            {profile.latestImport
              ? t("profile.addGames.latestImport", {
                  date: formatDate(profile.latestImport.createdAt, locale),
                })
              : t("common.readyWhenYouAre")}
          </div>
        }
      />

      <div className="grid grid-cols-[0.9fr_1.1fr] gap-6 max-lg:grid-cols-1">
        <article className="rounded-inner border border-edge bg-surface p-5 shadow-rest">
          <SectionHeader
            eyebrow={t("profile.sources.label")}
            title={t("profile.addGames.sourcesTitle")}
            aside={
              <Button asChild>
                <a href="/profile?tab=integrations">
                  {t("profile.addGames.manageSources")}
                </a>
              </Button>
            }
          />
          <p className="text-sm leading-relaxed text-ink-soft">
            {t("profile.addGames.sourcesBody")}
          </p>
          <p className="mt-4 text-sm font-semibold">
            {profile.user.externalAccounts.length === 1
              ? t("profile.addGames.connectedOne")
              : t("profile.addGames.connectedMany", {
                  count: formatNumber(
                    profile.user.externalAccounts.length,
                    locale,
                  ),
                })}
          </p>
        </article>

        <article className="rounded-inner border border-edge bg-surface p-5 shadow-rest">
          <SectionHeader
            eyebrow={t("profile.addGames.fileImport")}
            title={t("profile.addGames.uploadCsv")}
          />
          <CsvImportWidget action={importCsvAction} />
        </article>
      </div>
    </section>
  );
}

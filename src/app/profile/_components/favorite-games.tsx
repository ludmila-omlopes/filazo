import { EmptyState } from "@/components/ui/empty-state";
import { GameCard } from "@/components/game-card";
import { SectionHeader } from "@/components/ui/section-header";
import { createTranslator, type Locale } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils";
import { FavoriteButton } from "./favorite-button";
import type { ProfileData } from "./profile-types";

export function FavoriteGames({
  locale,
  profile,
}: {
  locale: Locale;
  profile: ProfileData;
}) {
  const t = createTranslator(locale);

  return (
    <section className="panel">
      <SectionHeader
        eyebrow={t("profile.favorites.label")}
        title={t("profile.favorites.title")}
        aside={
          <div className="pill">
            {t("profile.favorites.keptClose", {
              count: formatNumber(profile.favoriteEntries.length, locale),
            })}
          </div>
        }
      />

      {profile.favoriteEntries.length ? (
        <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {profile.favoriteEntries.map((entry) => (
            <div className="grid gap-2" key={`fav-${entry.id}`}>
              <GameCard
                game={entry.game}
                isPhysicalCopy={entry.isPhysicalCopy}
                platformName={entry.platformName}
                playtimeMinutes={entry.playtimeMinutes}
                completionPercent={entry.completionPercent}
                status={
                  entry.finishedAt && entry.status !== "COMPLETED"
                    ? "FINISHED"
                    : entry.status
                }
                locale={locale}
                variant="shelf"
              />
              <FavoriteButton
                entryId={entry.id}
                gameName={entry.game.name}
                isFavorite={entry.isFavorite}
                locale={locale}
                fullWidth
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title={t("profile.favorites.emptyTitle")}>
          {t("profile.favorites.emptyBody")}
        </EmptyState>
      )}
    </section>
  );
}

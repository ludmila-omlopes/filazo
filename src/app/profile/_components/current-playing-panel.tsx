import { Sparkles } from "lucide-react";
import { GameCard } from "@/components/game-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { getStatusDisplayLabel } from "@/lib/copy";
import { createTranslator, type Locale } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils";
import {
  clearCurrentPlayingAction,
  saveCurrentPlayingAction,
} from "../actions";
import type { PlayerProfileData, ProfileData } from "./profile-types";

const CURRENT_PLAYING_SLOTS = [1, 2, 3] as const;
const collator = new Intl.Collator("en-US", { sensitivity: "base" });

type ShelfEntry = ProfileData["shelfEntries"][number];
type SuggestedCurrentPlayingEntry = {
  entry: ShelfEntry;
  reason: string;
  source: "profile" | "shelf";
};

function isFinishedEntry(entry: ShelfEntry) {
  return entry.status === "COMPLETED" || Boolean(entry.finishedAt);
}

function getCurrentPlayingEntry(
  profile: ProfileData,
  slot: (typeof CURRENT_PLAYING_SLOTS)[number],
) {
  return (
    profile.currentPlayingEntries.find(
      (entry) => entry.currentPlayingSlot === slot,
    ) ?? null
  );
}

function getPlayingStatusEntries(profile: ProfileData) {
  return profile.shelfEntries
    .filter((entry) => entry.status === "PLAYING" && !isFinishedEntry(entry))
    .sort((left, right) => {
      const updatedDelta = right.updatedAt.getTime() - left.updatedAt.getTime();
      if (updatedDelta !== 0) {
        return updatedDelta;
      }

      return collator.compare(left.game.name, right.game.name);
    })
    .slice(0, CURRENT_PLAYING_SLOTS.length);
}

function getDefaultCurrentPlayingEntry(
  profile: ProfileData,
  playingStatusEntries: ShelfEntry[],
  slot: (typeof CURRENT_PLAYING_SLOTS)[number],
) {
  return (
    getCurrentPlayingEntry(profile, slot) ??
    (profile.currentPlayingEntries.length === 0
      ? playingStatusEntries[slot - 1]
      : null) ??
    null
  );
}

function getSelectableEntries(profile: ProfileData) {
  return [...profile.shelfEntries].sort((left, right) => {
    const nameDelta = collator.compare(left.game.name, right.game.name);
    if (nameDelta !== 0) {
      return nameDelta;
    }

    return collator.compare(left.id, right.id);
  });
}

function getOptionMeta(entry: ShelfEntry, locale: Locale) {
  const displayStatus =
    entry.finishedAt && entry.status !== "COMPLETED" ? "FINISHED" : entry.status;

  return [entry.platformName, getStatusDisplayLabel(displayStatus, locale)]
    .filter(Boolean)
    .join(" - ");
}

function scoreShelfEntry(entry: ShelfEntry) {
  if (isFinishedEntry(entry)) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  if (entry.status === "PLAYING") {
    score += 120;
  } else if (entry.status === "BACKLOG") {
    score += 30;
  } else if (entry.status === "OWNED") {
    score += 20;
  }

  if (entry.isFavorite) {
    score += 35;
  }

  if (entry.playtimeMinutes && entry.playtimeMinutes > 0) {
    score += Math.min(40, Math.round(entry.playtimeMinutes / 90));
  }

  if (entry.completionPercent && entry.completionPercent > 0) {
    score += entry.completionPercent >= 100 ? 0 : 18;
  }

  if (entry.lastPlayedAt) {
    const daysSincePlayed = Math.floor(
      (Date.now() - entry.lastPlayedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSincePlayed <= 14) {
      score += 55;
    } else if (daysSincePlayed <= 45) {
      score += 35;
    } else if (daysSincePlayed <= 90) {
      score += 18;
    }
  }

  if (entry.game.aggregatedRating) {
    score += Math.round(entry.game.aggregatedRating / 10);
  }

  return score;
}

function getShelfSuggestionReason(
  entry: ShelfEntry,
  t: ReturnType<typeof createTranslator>,
) {
  if (entry.status === "PLAYING") {
    return t("profile.currentPlaying.reason.playing");
  }

  if (entry.lastPlayedAt) {
    return t("profile.currentPlaying.reason.recent");
  }

  if (entry.isFavorite) {
    return t("profile.currentPlaying.reason.favorite");
  }

  if (entry.playtimeMinutes && entry.playtimeMinutes > 0) {
    return t("profile.currentPlaying.reason.playtime");
  }

  return t("profile.currentPlaying.reason.default");
}

function getSuggestedCurrentPlayingEntries({
  locale,
  playerProfile,
  profile,
}: {
  locale: Locale;
  playerProfile: PlayerProfileData;
  profile: ProfileData;
}) {
  const suggestions: SuggestedCurrentPlayingEntry[] = [];
  const seenEntryIds = new Set<string>();
  const unfinishedEntries = profile.shelfEntries.filter((entry) => !isFinishedEntry(entry));
  const t = createTranslator(locale);

  for (const recommendation of playerProfile?.payload.recommendations ?? []) {
    const matchingEntry = unfinishedEntries.find(
      (entry) =>
        !seenEntryIds.has(entry.id) && entry.game.slug === recommendation.slug,
    );

    if (!matchingEntry) {
      continue;
    }

    suggestions.push({
      entry: matchingEntry,
      reason: recommendation.reason,
      source: "profile",
    });
    seenEntryIds.add(matchingEntry.id);

    if (suggestions.length === CURRENT_PLAYING_SLOTS.length) {
      return suggestions;
    }
  }

  const rankedShelfEntries = unfinishedEntries
    .filter((entry) => !seenEntryIds.has(entry.id))
    .sort((left, right) => {
      const scoreDelta = scoreShelfEntry(right) - scoreShelfEntry(left);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return collator.compare(left.game.name, right.game.name);
    });

  for (const entry of rankedShelfEntries) {
    suggestions.push({
      entry,
      reason: getShelfSuggestionReason(entry, t),
      source: "shelf",
    });
    seenEntryIds.add(entry.id);

    if (suggestions.length === CURRENT_PLAYING_SLOTS.length) {
      break;
    }
  }

  return suggestions;
}

function CurrentPlayingSlot({
  entry,
  locale,
  slot,
}: {
  entry: ShelfEntry | null;
  locale: Locale;
  slot: (typeof CURRENT_PLAYING_SLOTS)[number];
}) {
  const t = createTranslator(locale);

  if (!entry) {
    return (
      <article className="grid min-h-[280px] gap-3 rounded-card border border-dashed border-edge bg-canvas/55 p-5 shadow-rest">
        <div>
          <p className="section-label !mb-1">
            {t("profile.currentPlaying.spot", { slot })}
          </p>
          <h3 className="font-display text-xl leading-tight">
            {t("profile.currentPlaying.openTitle")}
          </h3>
        </div>
        <p className="max-w-[28ch] text-sm leading-relaxed text-ink-soft">
          {t("profile.currentPlaying.openBody")}
        </p>
      </article>
    );
  }

  return (
    <GameCard
      chips={[t("profile.currentPlaying.spot", { slot })]}
      className="h-full"
      completionPercent={entry.completionPercent}
      finished={Boolean(entry.finishedAt)}
      game={entry.game}
      locale={locale}
      platformName={entry.platformName}
      playtimeMinutes={entry.playtimeMinutes}
      status={entry.status}
      variant="slot"
    />
  );
}

function SuggestedPicks({
  entries,
  locale,
}: {
  entries: SuggestedCurrentPlayingEntry[];
  locale: Locale;
}) {
  const t = createTranslator(locale);

  if (!entries.length) {
    return null;
  }

  return (
    <div className="rounded-card border border-edge bg-surface p-5 shadow-rest">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-label !mb-1">
            {t("profile.currentPlaying.suggestedLabel")}
          </p>
          <h3 className="font-display text-xl leading-tight">
            {t("profile.currentPlaying.suggestedTitle")}
          </h3>
        </div>
        <form action={saveCurrentPlayingAction}>
          {entries.map((suggestion, index) => (
            <input
              key={suggestion.entry.id}
              name={`slot${index + 1}EntryId`}
              type="hidden"
              value={suggestion.entry.id}
            />
          ))}
          <Button type="submit">
            <Sparkles className="h-4 w-4" />
            {t("profile.currentPlaying.useThese")}
          </Button>
        </form>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {entries.map((suggestion) => (
          <div className="grid gap-2" key={suggestion.entry.id}>
            <GameCard
              className="h-full"
              completionPercent={suggestion.entry.completionPercent}
              description={suggestion.reason}
              finished={Boolean(suggestion.entry.finishedAt)}
              game={suggestion.entry.game}
              eyebrow={
                suggestion.source === "profile"
                  ? t("profile.currentPlaying.fromProfile")
                  : t("profile.currentPlaying.fromShelf")
              }
              locale={locale}
              platformName={suggestion.entry.platformName}
              playtimeMinutes={suggestion.entry.playtimeMinutes}
              status={suggestion.entry.status}
              variant="shelf"
            />
          </div>
        ))}
      </div>

      <details className="mt-4 rounded-inner border border-edge bg-canvas/60 p-4 text-sm leading-relaxed text-ink-soft">
        <summary className="cursor-pointer font-semibold text-ink">
          {t("profile.currentPlaying.howChosen")}
        </summary>
        <p className="mt-2">{t("profile.currentPlaying.howChosenBody")}</p>
      </details>
    </div>
  );
}

export function CurrentPlayingPanel({
  locale,
  playerProfile,
  profile,
}: {
  locale: Locale;
  playerProfile: PlayerProfileData;
  profile: ProfileData;
}) {
  const t = createTranslator(locale);
  const selectableEntries = getSelectableEntries(profile);
  const currentPlayingEntries = profile.currentPlayingEntries;
  const playingStatusEntries = getPlayingStatusEntries(profile);
  const defaultCurrentPlayingEntries =
    currentPlayingEntries.length > 0
      ? currentPlayingEntries
      : playingStatusEntries;
  const suggestedEntries =
    currentPlayingEntries.length === 0
      ? getSuggestedCurrentPlayingEntries({ locale, playerProfile, profile })
      : [];

  return (
    <section className="panel bg-sage-soft/40">
      <SectionHeader
        aside={
          <div className="pill">
            {t("profile.currentPlaying.inView", {
              count: formatNumber(defaultCurrentPlayingEntries.length, locale),
            })}
          </div>
        }
        eyebrow={t("profile.currentPlaying.label")}
        title={t("profile.currentPlaying.title")}
        description={t("profile.currentPlaying.description")}
      />

      {defaultCurrentPlayingEntries.length ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {CURRENT_PLAYING_SLOTS.map((slot) => (
            <CurrentPlayingSlot
              entry={getDefaultCurrentPlayingEntry(
                profile,
                playingStatusEntries,
                slot,
              )}
              key={slot}
              locale={locale}
              slot={slot}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-5">
          <EmptyState title={t("profile.currentPlaying.emptyTitle")}>
            {t("profile.currentPlaying.emptyBody")}
          </EmptyState>
          <SuggestedPicks entries={suggestedEntries} locale={locale} />
        </div>
      )}

      <details
        className="mt-5 rounded-card border border-edge bg-surface p-5 shadow-rest"
        open={currentPlayingEntries.length === 0}
      >
        <summary className="cursor-pointer font-bold text-ink">
          {currentPlayingEntries.length
            ? t("profile.currentPlaying.chooseChange")
            : t("profile.currentPlaying.choose")}
        </summary>

        <form action={saveCurrentPlayingAction} className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {CURRENT_PLAYING_SLOTS.map((slot) => {
              const currentEntry = getDefaultCurrentPlayingEntry(
                profile,
                playingStatusEntries,
                slot,
              );

              return (
                <label
                  className="grid gap-2 rounded-inner border border-edge bg-canvas/60 p-4"
                  key={slot}
                >
                  <span className="section-label !mb-0">
                    {t("profile.currentPlaying.spot", { slot })}
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    {t("common.chooseGame")}
                  </span>
                  <select
                    className="min-h-11 w-full rounded-inner border border-edge bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
                    defaultValue={currentEntry?.id ?? ""}
                    key={`${slot}-${currentEntry?.id ?? "empty"}`}
                    name={`slot${slot}EntryId`}
                  >
                    <option value="">{t("profile.currentPlaying.leaveOpen")}</option>
                    {selectableEntries.map((entry) => {
                      const optionMeta = getOptionMeta(entry, locale);

                      return (
                        <option key={entry.id} value={entry.id}>
                          {entry.game.name}
                          {optionMeta ? ` - ${optionMeta}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit">{t("profile.currentPlaying.save")}</Button>
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            {t("profile.currentPlaying.help")}
          </p>
        </form>

        {currentPlayingEntries.length ? (
          <form action={clearCurrentPlayingAction} className="mt-3">
            <Button type="submit" variant="ghost">
              {t("common.clearAll")}
            </Button>
          </form>
        ) : null}
      </details>
    </section>
  );
}

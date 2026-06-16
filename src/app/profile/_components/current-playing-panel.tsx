import { Sparkles } from "lucide-react";
import { GameCard } from "@/components/game-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { getStatusDisplayLabel } from "@/lib/copy";
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

function getOptionMeta(entry: ShelfEntry) {
  const displayStatus =
    entry.finishedAt && entry.status !== "COMPLETED" ? "FINISHED" : entry.status;

  return [entry.platformName, getStatusDisplayLabel(displayStatus)]
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

function getShelfSuggestionReason(entry: ShelfEntry) {
  if (entry.status === "PLAYING") {
    return "Already marked as playing now, so it belongs near the top.";
  }

  if (entry.lastPlayedAt) {
    return "You touched it recently, which makes it a natural keep-in-view pick.";
  }

  if (entry.isFavorite) {
    return "It is one of your favorites and still has room to come back into focus.";
  }

  if (entry.playtimeMinutes && entry.playtimeMinutes > 0) {
    return "You already have time in it, which makes it a gentle return candidate.";
  }

  return "A steady unfinished pick from your own shelf.";
}

function getSuggestedCurrentPlayingEntries({
  playerProfile,
  profile,
}: {
  playerProfile: PlayerProfileData;
  profile: ProfileData;
}) {
  const suggestions: SuggestedCurrentPlayingEntry[] = [];
  const seenEntryIds = new Set<string>();
  const unfinishedEntries = profile.shelfEntries.filter((entry) => !isFinishedEntry(entry));

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
      reason: getShelfSuggestionReason(entry),
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
  slot,
}: {
  entry: ShelfEntry | null;
  slot: (typeof CURRENT_PLAYING_SLOTS)[number];
}) {
  if (!entry) {
    return (
      <article className="grid min-h-[280px] gap-3 rounded-card border border-dashed border-edge bg-canvas/55 p-5 shadow-rest">
        <div>
          <p className="section-label !mb-1">Spot {slot}</p>
          <h3 className="font-display text-xl leading-tight">Open for a game</h3>
        </div>
        <p className="max-w-[28ch] text-sm leading-relaxed text-ink-soft">
          Leave this slot empty, or pick something below when you want it in
          view.
        </p>
      </article>
    );
  }

  return (
    <GameCard
      chips={[`Spot ${slot}`]}
      className="h-full"
      completionPercent={entry.completionPercent}
      finished={Boolean(entry.finishedAt)}
      game={entry.game}
      platformName={entry.platformName}
      playtimeMinutes={entry.playtimeMinutes}
      status={entry.status}
      variant="slot"
    />
  );
}

function SuggestedPicks({
  entries,
}: {
  entries: SuggestedCurrentPlayingEntry[];
}) {
  if (!entries.length) {
    return null;
  }

  return (
    <div className="rounded-card border border-edge bg-surface p-5 shadow-rest">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-label !mb-1">Suggested picks</p>
          <h3 className="font-display text-xl leading-tight">
            A calm place to start
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
            Use these picks
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
                  ? "From your profile"
                  : "From your shelf"
              }
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
          How these picks were chosen
        </summary>
        <p className="mt-2">
          Saved player-profile recommendations come first when they exist.
          Remaining spots fall back to unfinished shelf entries with signals
          like playing status, recent activity, favorites, playtime, and shared
          review score. These suggestions come from your own catalog, not live
          web research.
        </p>
      </details>
    </div>
  );
}

export function CurrentPlayingPanel({
  playerProfile,
  profile,
}: {
  playerProfile: PlayerProfileData;
  profile: ProfileData;
}) {
  const selectableEntries = getSelectableEntries(profile);
  const currentPlayingEntries = profile.currentPlayingEntries;
  const playingStatusEntries = getPlayingStatusEntries(profile);
  const defaultCurrentPlayingEntries =
    currentPlayingEntries.length > 0
      ? currentPlayingEntries
      : playingStatusEntries;
  const suggestedEntries =
    currentPlayingEntries.length === 0
      ? getSuggestedCurrentPlayingEntries({ playerProfile, profile })
      : [];

  return (
    <section className="panel bg-sage-soft/40">
      <SectionHeader
        aside={
          <div className="pill">
            {defaultCurrentPlayingEntries.length} of {CURRENT_PLAYING_SLOTS.length} in view
          </div>
        }
        eyebrow="Current playing"
        title="Keep a few games close"
        description="Choose up to three shelf entries and pin them to the top of your overview."
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
              slot={slot}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-5">
          <EmptyState title="Nothing is pinned right now.">
            Pick up to three games to keep your current rotation visible at a
            glance.
          </EmptyState>
          <SuggestedPicks entries={suggestedEntries} />
        </div>
      )}

      <details
        className="mt-5 rounded-card border border-edge bg-surface p-5 shadow-rest"
        open={currentPlayingEntries.length === 0}
      >
        <summary className="cursor-pointer font-bold text-ink">
          {currentPlayingEntries.length
            ? "Choose or change your three picks"
            : "Choose your three picks"}
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
                  <span className="section-label !mb-0">Spot {slot}</span>
                  <span className="text-sm font-semibold text-ink">
                    Choose a game
                  </span>
                  <select
                    className="min-h-11 w-full rounded-inner border border-edge bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
                    defaultValue={currentEntry?.id ?? ""}
                    key={`${slot}-${currentEntry?.id ?? "empty"}`}
                    name={`slot${slot}EntryId`}
                  >
                    <option value="">Leave this open</option>
                    {selectableEntries.map((entry) => {
                      const optionMeta = getOptionMeta(entry);

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
            <Button type="submit">Save current playing</Button>
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            Leave any slot empty to clear it. You can feature fewer than three
            games if that feels better.
          </p>
        </form>

        {currentPlayingEntries.length ? (
          <form action={clearCurrentPlayingAction} className="mt-3">
            <Button type="submit" variant="ghost">
              Clear all
            </Button>
          </form>
        ) : null}
      </details>
    </section>
  );
}

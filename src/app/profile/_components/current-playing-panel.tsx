"use client";

import { Ban, CheckCircle2, Sparkles, X } from "lucide-react";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";
import { GameCard } from "@/components/game-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { createTranslator, type Locale } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils";
import {
  clearCurrentPlayingSelectionAction,
  currentPlayingDropAction,
  currentPlayingFinishAction,
  saveCurrentPlayingSelectionAction,
} from "../actions";
import type { PlayerProfileData, ProfileData } from "./profile-types";

const CURRENT_PLAYING_SLOTS = [1, 2, 3] as const;
const collator = new Intl.Collator("en-US", { sensitivity: "base" });

type CurrentPlayingSlotNumber = (typeof CURRENT_PLAYING_SLOTS)[number];
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
  slot: CurrentPlayingSlotNumber,
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
  slot: CurrentPlayingSlotNumber,
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
  excludedEntryIds = new Set<string>(),
  limit = CURRENT_PLAYING_SLOTS.length,
  locale,
  playerProfile,
  profile,
}: {
  excludedEntryIds?: Set<string>;
  limit?: number;
  locale: Locale;
  playerProfile: PlayerProfileData;
  profile: ProfileData;
}) {
  const suggestions: SuggestedCurrentPlayingEntry[] = [];
  const seenEntryIds = new Set(excludedEntryIds);
  const unfinishedEntries = profile.shelfEntries.filter(
    (entry) => !isFinishedEntry(entry),
  );
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

    if (suggestions.length === limit) {
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

    if (suggestions.length === limit) {
      break;
    }
  }

  return suggestions;
}

function CurrentPlayingSlot({
  animated,
  entry,
  isSaving,
  locale,
  onRemove,
  onDragEnd,
  onDrop,
  onFinish,
  slot,
}: {
  animated: boolean;
  entry: ShelfEntry | null;
  isSaving: boolean;
  locale: Locale;
  onRemove: () => void;
  onDragEnd: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: () => void;
  onFinish: () => void;
  slot: CurrentPlayingSlotNumber;
}) {
  const t = createTranslator(locale);

  if (!entry) {
    return (
      <div
        className="grid min-h-[280px] gap-3 rounded-card border border-dashed border-edge bg-canvas/55 p-5 text-left shadow-rest outline-none transition-colors duration-200 hover:bg-canvas/75 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
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
      </div>
    );
  }

  return (
    <div
      className={animated ? "grid gap-3 animate-current-playing-place" : "grid gap-3"}
      draggable
      onDragEnd={onDragEnd}
      title={t("profile.currentPlaying.dragOut")}
    >
      <GameCard
        className="h-full"
        completionPercent={entry.completionPercent}
        finished={false}
        game={entry.game}
        locale={locale}
        platformName={entry.platformName}
        playtimeMinutes={entry.playtimeMinutes}
        status={null}
        variant="slot"
      />
      <div className="grid gap-2 rounded-inner border border-edge bg-surface/80 p-2 shadow-rest">
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="min-w-0 px-2 text-xs sm:text-sm"
            disabled={isSaving}
            onClick={onFinish}
            size="sm"
            type="button"
            variant="secondary"
          >
            <CheckCircle2 className="h-4 w-4" />
            {t("profile.currentPlaying.finish")}
          </Button>
          <Button
            className="min-w-0 px-2 text-xs sm:text-sm"
            disabled={isSaving}
            onClick={onDrop}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Ban className="h-4 w-4" />
            {t("profile.currentPlaying.drop")}
          </Button>
        </div>
        <Button
          aria-label={t("profile.currentPlaying.remove", {
            name: entry.game.name,
          })}
          disabled={isSaving}
          onClick={onRemove}
          size="sm"
          type="button"
          variant="link"
          className="min-w-0 text-xs sm:text-sm"
        >
          <X className="h-4 w-4" />
          {t("profile.currentPlaying.removeFromView")}
        </Button>
      </div>
    </div>
  );
}

function FinishCelebrationDialog({
  gameName,
  locale,
  onClose,
  providerRefreshStatus,
}: {
  gameName: string;
  locale: Locale;
  onClose: () => void;
  providerRefreshStatus: "refreshed" | "unavailable" | "failed";
}) {
  const t = createTranslator(locale);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const refreshMessage =
    providerRefreshStatus === "refreshed"
      ? t("profile.currentPlaying.refresh.refreshed")
      : providerRefreshStatus === "failed"
        ? t("profile.currentPlaying.refresh.failed")
        : t("profile.currentPlaying.refresh.unavailable");

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-4 backdrop-blur-sm">
      <div
        aria-labelledby="current-playing-finished-title"
        aria-modal="true"
        className="w-full max-w-[460px] rounded-card border border-edge bg-surface p-6 text-ink shadow-float motion-safe:animate-current-playing-place"
        role="dialog"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="section-label !mb-2">
              {t("profile.currentPlaying.finishedDialogLabel")}
            </p>
            <h3
              className="font-display text-3xl leading-tight"
              id="current-playing-finished-title"
            >
              {t("profile.currentPlaying.finishedDialogTitle")}
            </h3>
          </div>
          <Button
            aria-label={t("profile.currentPlaying.dismissCelebration")}
            onClick={onClose}
            ref={closeButtonRef}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mb-5 overflow-hidden rounded-inner border border-edge bg-sage-soft/55 px-4 py-3">
          <div className="motion-safe:animate-finish-signal h-1.5 w-24 rounded-pill bg-fern" />
        </div>
        <p className="text-base leading-relaxed">
          {t("profile.currentPlaying.finishedDialogBody", { name: gameName })}
        </p>
        <p className="mt-3 text-sm font-semibold text-ink-soft">
          {refreshMessage}
        </p>
        <div className="mt-6 flex justify-end">
          <Button onClick={onClose} type="button">
            {t("common.close")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SuggestedPicks({
  entries,
  isSaving,
  locale,
  onFillOpenSpots,
  onPick,
  selectedEntryIds,
}: {
  entries: SuggestedCurrentPlayingEntry[];
  isSaving: boolean;
  locale: Locale;
  onFillOpenSpots: () => void;
  onPick: (entryId: string) => void;
  selectedEntryIds: Set<string>;
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
        <Button disabled={isSaving} onClick={onFillOpenSpots} type="button">
          <Sparkles className="h-4 w-4" />
          {t("profile.currentPlaying.fillOpenSpots")}
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {entries.map((suggestion) => (
          <div className="grid gap-2" key={suggestion.entry.id}>
            <GameCard
              className="h-full"
              completionPercent={suggestion.entry.completionPercent}
              description={suggestion.reason}
              disabled={isSaving || selectedEntryIds.has(suggestion.entry.id)}
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
              onClick={() => onPick(suggestion.entry.id)}
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
  const router = useRouter();
  const t = createTranslator(locale);
  const panelRef = useRef<HTMLElement | null>(null);
  const currentPlayingAreaRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollToCardsRef = useRef(false);
  const selectableEntries = getSelectableEntries(profile);
  const playingStatusEntries = getPlayingStatusEntries(profile);
  const initialEntriesBySlot = new Map(
    CURRENT_PLAYING_SLOTS.flatMap((slot) => {
      const entry = getDefaultCurrentPlayingEntry(
        profile,
        playingStatusEntries,
        slot,
      );

      return entry ? [[slot, entry] as const] : [];
    }),
  );
  const [selectedEntryIdsBySlot, setSelectedEntryIdsBySlot] = useState(
    () =>
      new Map(
        CURRENT_PLAYING_SLOTS.flatMap((slot) => {
          const entry = initialEntriesBySlot.get(slot);
          return entry ? [[slot, entry.id] as const] : [];
        }),
      ),
  );
  const [animatedSlot, setAnimatedSlot] =
    useState<CurrentPlayingSlotNumber | null>(null);
  const [autosaveCount, setAutosaveCount] = useState(0);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [entryActionError, setEntryActionError] = useState<string | null>(null);
  const [pendingEntryAction, setPendingEntryAction] = useState<{
    entryId: string;
    action: "drop" | "finish";
  } | null>(null);
  const [actionedEntryIds, setActionedEntryIds] = useState(
    () => new Set<string>(),
  );
  const [celebration, setCelebration] = useState<{
    gameName: string;
    providerRefreshStatus: "refreshed" | "unavailable" | "failed";
  } | null>(null);
  const selectableEntryById = new Map(
    selectableEntries.map((entry) => [entry.id, entry]),
  );
  const selectedEntriesBySlot = new Map(
    CURRENT_PLAYING_SLOTS.flatMap((slot) => {
      const entryId = selectedEntryIdsBySlot.get(slot);
      const entry = entryId ? selectableEntryById.get(entryId) : null;

      return entry ? [[slot, entry] as const] : [];
    }),
  );
  const selectedEntryIds = new Set(selectedEntryIdsBySlot.values());
  const excludedSuggestionEntryIds = new Set([
    ...selectedEntryIds,
    ...actionedEntryIds,
  ]);
  const openSlots = CURRENT_PLAYING_SLOTS.filter(
    (slot) => !selectedEntriesBySlot.has(slot),
  );
  const isAutosaving = autosaveCount > 0;
  const isBusy = isAutosaving || isClearing || pendingEntryAction !== null;
  const suggestedEntries = openSlots.length
    ? getSuggestedCurrentPlayingEntries({
        excludedEntryIds: excludedSuggestionEntryIds,
        limit: openSlots.length,
        locale,
        playerProfile,
        profile,
      })
    : [];

  useEffect(() => {
    if (!pendingScrollToCardsRef.current) {
      return;
    }

    pendingScrollToCardsRef.current = false;
    const target = currentPlayingAreaRef.current ?? panelRef.current;
    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [selectedEntriesBySlot.size]);

  function animateSlot(slot: CurrentPlayingSlotNumber) {
    setAnimatedSlot(slot);
    window.setTimeout(() => setAnimatedSlot(null), 620);
  }

  const closeCelebration = useCallback(() => {
    setCelebration(null);
  }, []);

  function buildCurrentPlayingFormData(
    selection: Map<CurrentPlayingSlotNumber, string>,
  ) {
    const formData = new FormData();
    for (const slot of CURRENT_PLAYING_SLOTS) {
      formData.set(`slot${slot}EntryId`, selection.get(slot) ?? "");
    }

    return formData;
  }

  function autosaveSelection(selection: Map<CurrentPlayingSlotNumber, string>) {
    const formData = buildCurrentPlayingFormData(selection);
    setAutosaveError(null);
    setAutosaveCount((count) => count + 1);

    void saveCurrentPlayingSelectionAction(formData)
      .then((result) => {
        if (!result.ok) {
          setAutosaveError(result.message);
        }
      })
      .finally(() => {
        setAutosaveCount((count) => Math.max(0, count - 1));
      });
  }

  async function clearSelections() {
    const previousSelection = new Map(selectedEntryIdsBySlot);
    setSelectedEntryIdsBySlot(new Map());
    setAutosaveError(null);
    setIsClearing(true);

    try {
      const result = await clearCurrentPlayingSelectionAction();
      if (!result.ok) {
        setSelectedEntryIdsBySlot(previousSelection);
        setAutosaveError(result.message);
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsClearing(false);
    }
  }

  function getSelectionWithSlotEntry({
    entryId,
    selection,
    slot,
  }: {
    entryId: string | null;
    selection: Map<CurrentPlayingSlotNumber, string>;
    slot: CurrentPlayingSlotNumber;
  }) {
    const next = new Map(selection);
    if (entryId) {
      for (const [existingSlot, existingEntryId] of next) {
        if (existingSlot !== slot && existingEntryId === entryId) {
          next.delete(existingSlot);
        }
      }
      next.set(slot, entryId);
    } else {
      next.delete(slot);
    }

    return next;
  }

  function setSlotEntry(
    slot: CurrentPlayingSlotNumber,
    entryId: string | null,
    shouldAnimate = false,
  ) {
    if (entryId) {
      pendingScrollToCardsRef.current = true;
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        activeElement.blur();
      }
    }

    const next = getSelectionWithSlotEntry({
      entryId,
      selection: selectedEntryIdsBySlot,
      slot,
    });

    setSelectedEntryIdsBySlot(next);
    autosaveSelection(next);

    if (shouldAnimate) {
      animateSlot(slot);
    }
  }

  function removeSlotEntry(slot: CurrentPlayingSlotNumber) {
    if (!selectedEntriesBySlot.has(slot)) {
      return;
    }

    setSlotEntry(slot, null);
  }

  function removeEntryFromLocalSelection(entryId: string) {
    setSelectedEntryIdsBySlot((current) => {
      const next = new Map(current);
      for (const [slot, selectedEntryId] of next) {
        if (selectedEntryId === entryId) {
          next.delete(slot);
        }
      }

      return next;
    });
    setActionedEntryIds((current) => new Set([...current, entryId]));
  }

  async function runEntryAction(
    entry: ShelfEntry,
    action: "drop" | "finish",
  ) {
    const formData = new FormData();
    formData.set("entryId", entry.id);
    setEntryActionError(null);
    setPendingEntryAction({ entryId: entry.id, action });

    try {
      const result =
        action === "drop"
          ? await currentPlayingDropAction(formData)
          : await currentPlayingFinishAction(formData);

      if (!result.ok) {
        setEntryActionError(result.message);
        return;
      }

      removeEntryFromLocalSelection(entry.id);

      if (action === "finish") {
        setCelebration({
          gameName: result.gameName,
          providerRefreshStatus: result.providerRefreshStatus,
        });
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setEntryActionError(t("profile.currentPlaying.actionFailed"));
    } finally {
      setPendingEntryAction(null);
    }
  }

  function handleSlotDragEnd(
    slot: CurrentPlayingSlotNumber,
    event: DragEvent<HTMLDivElement>,
  ) {
    const area = currentPlayingAreaRef.current;
    if (!area || !selectedEntriesBySlot.has(slot)) {
      return;
    }

    if (event.clientX <= 0 && event.clientY <= 0) {
      return;
    }

    const rect = area.getBoundingClientRect();
    const droppedInsideArea =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (!droppedInsideArea) {
      removeSlotEntry(slot);
    }
  }

  function addSuggestedEntry(entryId: string) {
    const slot = openSlots[0];
    if (!slot) {
      return;
    }

    setSlotEntry(slot, entryId, true);
  }

  function fillOpenSpots() {
    const nextPicks = suggestedEntries.slice(0, openSlots.length);
    if (!nextPicks.length) {
      return;
    }

    const next = new Map(selectedEntryIdsBySlot);
    for (const [index, suggestion] of nextPicks.entries()) {
      const slot = openSlots[index];
      if (slot) {
        next.set(slot, suggestion.entry.id);
      }
    }

    setSelectedEntryIdsBySlot(next);
    autosaveSelection(next);
    animateSlot(openSlots[0]);
  }

  return (
    <section className="panel bg-sage-soft/40" ref={panelRef}>
      <SectionHeader
        aside={
          <div className="flex flex-wrap items-center justify-end gap-2 max-lg:justify-start">
            <div className="pill">
              {t("profile.currentPlaying.inView", {
                count: formatNumber(selectedEntriesBySlot.size, locale),
              })}
            </div>
            {selectedEntriesBySlot.size ? (
              <Button
                disabled={isBusy}
                onClick={() => {
                  void clearSelections();
                }}
                type="button"
                variant="ghost"
              >
                {t("profile.currentPlaying.clearTop")}
              </Button>
            ) : null}
          </div>
        }
        title={t("profile.currentPlaying.title")}
        description={t("profile.currentPlaying.description")}
      />

      {selectedEntriesBySlot.size ? (
        <div className="grid gap-5">
          <div
            className="grid gap-4 lg:grid-cols-3"
            ref={currentPlayingAreaRef}
          >
            {CURRENT_PLAYING_SLOTS.map((slot) => (
              <CurrentPlayingSlot
                animated={animatedSlot === slot}
                entry={selectedEntriesBySlot.get(slot) ?? null}
                isSaving={isBusy}
                key={slot}
                locale={locale}
                onDragEnd={(event) => handleSlotDragEnd(slot, event)}
                onDrop={() => {
                  const entry = selectedEntriesBySlot.get(slot);
                  if (entry) {
                    void runEntryAction(entry, "drop");
                  }
                }}
                onFinish={() => {
                  const entry = selectedEntriesBySlot.get(slot);
                  if (entry) {
                    void runEntryAction(entry, "finish");
                  }
                }}
                onRemove={() => removeSlotEntry(slot)}
                slot={slot}
              />
            ))}
          </div>
          {entryActionError ? (
            <p className="text-sm font-semibold text-red-200">
              {entryActionError}
            </p>
          ) : null}
          {autosaveError ? (
            <p className="text-sm font-semibold text-red-200">
              {autosaveError}
            </p>
          ) : null}
          <SuggestedPicks
            entries={suggestedEntries}
            isSaving={isAutosaving}
            locale={locale}
            onFillOpenSpots={fillOpenSpots}
            onPick={addSuggestedEntry}
            selectedEntryIds={selectedEntryIds}
          />
        </div>
      ) : (
        <div className="grid gap-5">
          <EmptyState title={t("profile.currentPlaying.emptyTitle")}>
            {t("profile.currentPlaying.emptyBody")}
          </EmptyState>
          <SuggestedPicks
            entries={suggestedEntries}
            isSaving={isAutosaving}
            locale={locale}
            onFillOpenSpots={fillOpenSpots}
            onPick={addSuggestedEntry}
            selectedEntryIds={selectedEntryIds}
          />
          {autosaveError ? (
            <p className="text-sm font-semibold text-red-200">
              {autosaveError}
            </p>
          ) : null}
        </div>
      )}

      {celebration ? (
        <FinishCelebrationDialog
          gameName={celebration.gameName}
          locale={locale}
          onClose={closeCelebration}
          providerRefreshStatus={celebration.providerRefreshStatus}
        />
      ) : null}

    </section>
  );
}

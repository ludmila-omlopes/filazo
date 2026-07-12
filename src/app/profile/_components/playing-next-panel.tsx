"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ListPlus,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { GameCard } from "@/components/game-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { SectionHeader } from "@/components/ui/section-header";
import { createTranslator, type Locale } from "@/lib/i18n";
import { formatNumber, formatTimeEstimate } from "@/lib/utils";
import {
  addPlayingNextGameAction,
  clearPlayingNextSelectionAction,
  savePlayingNextSelectionAction,
} from "../actions";
import type { ProfileData } from "./profile-types";

const PLAYING_NEXT_SLOTS = [1, 2, 3] as const;
const LONG_GAME_MINUTES = 20 * 60;

type PlayingNextSlotNumber = (typeof PLAYING_NEXT_SLOTS)[number];
type PlayingNextEntry = ProfileData["playingNextEntries"][number];

type SearchResult = {
  igdbId: number;
  name: string;
  slug: string | null;
  summary: string | null;
  coverUrl: string | null;
  releaseDate: string | null;
  platforms: string[];
  genres: string[];
  existingSlug: string | null;
  isDropped: boolean;
  isOwned: boolean;
  isQueued: boolean;
};

function readStringList(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    try {
      return readStringList(JSON.parse(value));
    } catch {
      return [value];
    }
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
}

function getGameEstimateMinutes(entry: PlayingNextEntry) {
  return (
    [
      entry.game.hltbMainExtraMinutes,
      entry.game.hltbMainStoryMinutes,
      entry.game.hltbCompletionistMinutes,
    ].find((minutes) => Boolean(minutes && minutes > 0)) ?? null
  );
}

function getPrimaryGenre(entry: PlayingNextEntry) {
  return readStringList(entry.game.genres)[0]?.trim() ?? null;
}

function getYear(value: string | null) {
  return value ? new Date(value).getFullYear() : null;
}

function getSelectionWarnings({
  entries,
  locale,
}: {
  entries: PlayingNextEntry[];
  locale: Locale;
}) {
  if (entries.length !== PLAYING_NEXT_SLOTS.length) {
    return [];
  }

  const t = createTranslator(locale);
  const warnings: string[] = [];
  const genres = entries
    .map((entry) => getPrimaryGenre(entry))
    .filter((genre): genre is string => Boolean(genre));

  if (
    genres.length === entries.length &&
    new Set(genres.map((genre) => genre.toLowerCase())).size === 1
  ) {
    warnings.push(t("profile.playingNext.sameGenreWarning", { genre: genres[0] }));
  }

  const estimates = entries
    .map((entry) => getGameEstimateMinutes(entry))
    .filter((minutes): minutes is number => Boolean(minutes && minutes > 0));

  if (
    estimates.length === entries.length &&
    estimates.every((minutes) => minutes >= LONG_GAME_MINUTES)
  ) {
    warnings.push(
      t("profile.playingNext.longGamesWarning", {
        duration: formatTimeEstimate(LONG_GAME_MINUTES, locale),
      }),
    );
  }

  return warnings;
}

function PlayingNextSlot({
  entry,
  isBusy,
  locale,
  needsPurchase,
  onOpenPicker,
  onRemove,
  slot,
}: {
  entry: PlayingNextEntry | null;
  isBusy: boolean;
  locale: Locale;
  needsPurchase: boolean;
  onOpenPicker: () => void;
  onRemove: () => void;
  slot: PlayingNextSlotNumber;
}) {
  const t = createTranslator(locale);

  if (!entry) {
    return (
      <button
        className="grid min-h-[220px] gap-3 rounded-card border border-dashed border-edge bg-canvas/55 p-5 text-left shadow-rest outline-none transition-colors duration-200 hover:bg-canvas/75 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        onClick={onOpenPicker}
        type="button"
      >
        <div className="grid h-10 w-10 place-items-center rounded-inner border border-edge bg-surface text-ink-soft">
          <ListPlus className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="section-label !mb-1">
            {t("profile.playingNext.spot", { slot })}
          </p>
          <h3 className="font-display text-lg leading-tight">
            {t("profile.playingNext.openTitle")}
          </h3>
        </div>
        <p className="max-w-[30ch] text-sm leading-relaxed text-ink-soft">
          {t("profile.playingNext.openBody")}
        </p>
      </button>
    );
  }

  function handleRemove(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onRemove();
  }

  return (
    <div className="group relative h-full rounded-card">
      <Button
        aria-label={t("profile.playingNext.remove", {
          name: entry.game.name,
        })}
        className="absolute right-3 top-3 z-10"
        disabled={isBusy}
        onClick={handleRemove}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <GameCard
        className="h-full transition-colors group-hover:border-sage"
        completionPercent={entry.completionPercent}
        finished={false}
        footer={
          needsPurchase ? (
            <span className="inline-flex w-fit max-w-full items-center gap-1 rounded-pill border border-edge bg-sand-soft px-3 py-1 text-xs font-bold text-ink shadow-rest">
              <ShoppingBag className="h-3.5 w-3.5 flex-none" aria-hidden />
              <span className="min-w-0 truncate">
                {t("profile.playingNext.notOwned")}
              </span>
            </span>
          ) : null
        }
        game={entry.game}
        isPhysicalCopy={entry.isPhysicalCopy}
        locale={locale}
        platformName={entry.platformName}
        playtimeMinutes={entry.playtimeMinutes}
        status={entry.status}
        statusVariant="none"
        variant="slot"
      />
    </div>
  );
}

export function PlayingNextPanel({
  locale,
  profile,
}: {
  locale: Locale;
  profile: ProfileData;
}) {
  const router = useRouter();
  const t = useMemo(() => createTranslator(locale), [locale]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [activeSlot, setActiveSlot] = useState<PlayingNextSlotNumber | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [savingIgdbId, setSavingIgdbId] = useState<number | null>(null);
  const queuedEntriesBySlot = new Map(
    PLAYING_NEXT_SLOTS.flatMap((slot, index) => {
      const entry = profile.playingNextEntries[index] ?? null;
      return entry ? [[slot, entry] as const] : [];
    }),
  );
  const warnings = getSelectionWarnings({
    entries: profile.playingNextEntries,
    locale,
  });
  const isBusy = isClearing || savingIgdbId !== null;

  useEffect(() => {
    if (!activeSlot) {
      return;
    }

    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [activeSlot]);

  useEffect(() => {
    if (!activeSlot) {
      return;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults((currentResults) =>
        currentResults.length ? [] : currentResults,
      );
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    const timeout = window.setTimeout(() => {
      fetch(`/api/profile/game-search?q=${encodeURIComponent(trimmedQuery)}`, {
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(t("profile.playingNext.searchFailed"));
          }
          return response.json() as Promise<{ results: SearchResult[] }>;
        })
        .then((data) => {
          setResults(data.results);
          setMessage(null);
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }
          setMessage(
            error instanceof Error
              ? error.message
              : t("profile.playingNext.searchFailed"),
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSearching(false);
          }
        });
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [activeSlot, query, t]);

  function getFirstOpenSlot() {
    return (
      PLAYING_NEXT_SLOTS.find((slot) => !queuedEntriesBySlot.has(slot)) ??
      PLAYING_NEXT_SLOTS[0]
    );
  }

  function openPicker(slot = getFirstOpenSlot()) {
    setActiveSlot(slot);
    setMessage(null);
  }

  function closePicker() {
    setActiveSlot(null);
    setMessage(null);
    setSavingIgdbId(null);
  }

  async function clearSelections() {
    setMessage(null);
    setIsClearing(true);

    try {
      const result = await clearPlayingNextSelectionAction();
      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsClearing(false);
    }
  }

  function buildPlayingNextFormDataWithoutSlot(slotToRemove: PlayingNextSlotNumber) {
    const formData = new FormData();
    for (const slot of PLAYING_NEXT_SLOTS) {
      if (slot === slotToRemove) {
        formData.set(`next${slot}EntryId`, "");
      } else {
        formData.set(
          `next${slot}EntryId`,
          queuedEntriesBySlot.get(slot)?.id ?? "",
        );
      }
    }

    return formData;
  }

  async function removeSlotEntry(slot: PlayingNextSlotNumber) {
    setMessage(null);
    const result = await savePlayingNextSelectionAction(
      buildPlayingNextFormDataWithoutSlot(slot),
    );

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  async function addSearchResult(result: SearchResult) {
    if (!activeSlot) {
      return;
    }

    if (
      result.isDropped &&
      !window.confirm(
        t("profile.playingNext.confirmDropped", { name: result.name }),
      )
    ) {
      return;
    }

    const formData = new FormData();
    formData.set("igdbId", String(result.igdbId));
    formData.set("platformName", result.platforms[0] ?? "");
    formData.set("replaceEntryId", queuedEntriesBySlot.get(activeSlot)?.id ?? "");
    formData.set("slot", String(activeSlot));
    formData.set("title", result.name);
    setSavingIgdbId(result.igdbId);
    setMessage(null);

    try {
      const saveResult = await addPlayingNextGameAction(formData);
      if (!saveResult.ok) {
        setMessage(saveResult.message);
        return;
      }

      closePicker();
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setSavingIgdbId(null);
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      closePicker();
    }
  }

  return (
    <section className="panel bg-surface">
      <SectionHeader
        aside={
          <div className="flex flex-wrap items-center justify-end gap-2 max-lg:justify-start">
            <div className="pill">
              {t("profile.playingNext.inQueue", {
                count: formatNumber(profile.playingNextEntries.length, locale),
              })}
            </div>
            {profile.playingNextEntries.length ? (
              <Button
                disabled={isBusy}
                onClick={() => {
                  void clearSelections();
                }}
                type="button"
                variant="ghost"
              >
                {t("profile.playingNext.clearTop")}
              </Button>
            ) : null}
          </div>
        }
        title={t("profile.playingNext.title")}
        description={t("profile.playingNext.description")}
      />

      {profile.playingNextEntries.length ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {PLAYING_NEXT_SLOTS.map((slot) => {
            const entry = queuedEntriesBySlot.get(slot) ?? null;

            return (
              <PlayingNextSlot
                entry={entry}
                isBusy={isBusy}
                key={slot}
                locale={locale}
                needsPurchase={
                  entry?.userIntent === "needs_purchase" && !entry.isPhysicalCopy
                }
                onOpenPicker={() => openPicker(slot)}
                onRemove={() => {
                  void removeSlotEntry(slot);
                }}
                slot={slot}
              />
            );
          })}
        </div>
      ) : (
        <button
          className="block w-full rounded-card text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          onClick={() => openPicker()}
          type="button"
        >
          <EmptyState title={t("profile.playingNext.emptyTitle")}>
            {t("profile.playingNext.emptyBody")}
          </EmptyState>
        </button>
      )}

      {warnings.length ? (
        <div className="mt-4 grid gap-3">
          {warnings.map((warning) => (
            <Notice
              icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
              key={warning}
              tone="info"
            >
              {warning}
            </Notice>
          ))}
        </div>
      ) : null}

      {message && !activeSlot ? (
        <p className="mt-3 text-sm font-semibold text-clay">{message}</p>
      ) : null}

      {activeSlot ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4"
          onMouseDown={handleBackdropClick}
        >
          <div
            aria-labelledby="playing-next-dialog-title"
            aria-modal="true"
            className="max-h-[min(760px,92vh)] w-full max-w-2xl overflow-y-auto rounded-card border border-edge bg-surface p-5 shadow-lift"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label !mb-1">
                  {t("profile.playingNext.spot", { slot: activeSlot })}
                </p>
                <h3
                  className="font-display text-2xl leading-tight"
                  id="playing-next-dialog-title"
                >
                  {t("profile.playingNext.searchTitle")}
                </h3>
              </div>
              <Button
                aria-label={t("common.close")}
                onClick={closePicker}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <label className="relative mt-5 block">
              <span className="sr-only">{t("profile.playingNext.searchLabel")}</span>
              <Search
                aria-hidden
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
              />
              <input
                className="min-h-11 w-full rounded-pill border border-edge bg-canvas px-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("profile.playingNext.searchPlaceholder")}
                ref={searchInputRef}
                type="search"
                value={query}
              />
            </label>

            {message ? (
              <p className="mt-3 text-sm font-semibold text-clay">{message}</p>
            ) : null}

            <div className="mt-4 grid gap-3">
              {results.map((result) => {
                const isSaving = savingIgdbId === result.igdbId;
                const meta = [
                  getYear(result.releaseDate),
                  result.platforms[0],
                  result.genres[0],
                ]
                  .filter(Boolean)
                  .join(" / ");

                return (
                  <button
                    className="grid grid-cols-[58px_1fr_auto] items-center gap-4 rounded-inner border border-edge bg-canvas/60 p-3 text-left transition-colors hover:border-sage disabled:cursor-wait disabled:opacity-70 max-sm:grid-cols-[52px_1fr]"
                    disabled={savingIgdbId !== null}
                    key={result.igdbId}
                    onClick={() => {
                      void addSearchResult(result);
                    }}
                    type="button"
                  >
                    <span className="relative aspect-[3/4] overflow-hidden rounded-[6px] bg-sage-soft">
                      {result.coverUrl ? (
                        <Image
                          alt=""
                          className="object-cover"
                          fill
                          sizes="58px"
                          src={result.coverUrl}
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-lg font-medium leading-tight">
                        {result.name}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-sm text-ink-soft">
                        {meta || t("profile.playingNext.catalogResult")}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-2">
                        {result.isOwned ? (
                          <span className="inline-flex items-center gap-1 rounded-pill border border-edge bg-sage-soft px-2.5 py-0.5 text-xs font-bold">
                            <Check className="h-3 w-3" aria-hidden />
                            {t("profile.playingNext.owned")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-pill border border-edge bg-sand-soft px-2.5 py-0.5 text-xs font-bold">
                            <ShoppingBag className="h-3 w-3" aria-hidden />
                            {t("profile.playingNext.notOwned")}
                          </span>
                        )}
                        {result.isQueued ? (
                          <span className="rounded-pill border border-edge bg-sky-soft px-2.5 py-0.5 text-xs font-bold">
                            {t("profile.playingNext.alreadyQueued")}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="rounded-pill border border-edge bg-surface px-3 py-1 text-xs font-bold max-sm:col-span-2">
                      {isSaving
                        ? t("profile.playingNext.saving")
                        : t("profile.playingNext.queueThis")}
                    </span>
                  </button>
                );
              })}
            </div>

            {isSearching ? (
              <p className="mt-4 text-sm font-semibold text-ink-soft">
                {t("profile.playingNext.searching")}
              </p>
            ) : null}

            {!isSearching && query.trim().length >= 2 && !results.length ? (
              <p className="mt-4 text-sm text-ink-soft">
                {t("profile.playingNext.noMatches")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

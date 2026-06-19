"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { addManualGameAction } from "../actions";

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
};

const statusOptions = [
  { value: "PLAYING", labelKey: "manualSearch.status.playing" },
  { value: "OWNED", labelKey: "manualSearch.status.owned" },
  { value: "BACKLOG", labelKey: "manualSearch.status.backlog" },
  { value: "COMPLETED", labelKey: "manualSearch.status.completed" },
  { value: "DROPPED", labelKey: "manualSearch.status.dropped" },
  { value: "WISHLIST", labelKey: "manualSearch.status.wishlist" },
] as const;

function getYear(value: string | null) {
  return value ? new Date(value).getFullYear() : null;
}

export function ManualGameLookupPanel({ enabled }: { enabled: boolean }) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedGame, setSelectedGame] = useState<SearchResult | null>(null);
  const [platformName, setPlatformName] = useState("");
  const [status, setStatus] = useState<(typeof statusOptions)[number]["value"]>(
    "PLAYING",
  );
  const [message, setMessage] = useState<string | null>(null);
  const selectedPlatformOptions = useMemo(
    () => selectedGame?.platforms.slice(0, 10) ?? [],
    [selectedGame],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch(`/api/profile/game-search?q=${encodeURIComponent(trimmedQuery)}`, {
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(t("manualSearch.searchFailed"));
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
            error instanceof Error ? error.message : t("manualSearch.searchFailed"),
          );
        });
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [enabled, query, t]);

  function selectGame(result: SearchResult) {
    setSelectedGame(result);
    setPlatformName(result.platforms[0] ?? "");
    setMessage(null);
  }

  if (!enabled) {
    return (
      <div className="rounded-inner border border-edge bg-surface p-5 shadow-rest">
        <SectionHeader eyebrow={t("manualSearch.eyebrow")} title={t("manualSearch.title")} />
        <EmptyState title={t("manualSearch.unavailableTitle")}>
          {t("manualSearch.unavailableBody")}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="rounded-inner border border-edge bg-surface p-5 shadow-rest">
      <SectionHeader eyebrow={t("manualSearch.eyebrow")} title={t("manualSearch.title")} />

      <div className="grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-semibold">{t("manualSearch.gameTitle")}</span>
          <input
            className="min-h-11 rounded-inner border border-edge bg-canvas px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              if (nextQuery.trim().length < 2) {
                setResults([]);
              }
            }}
            placeholder={t("manualSearch.placeholder")}
            type="search"
            value={query}
          />
        </label>

        {message ? (
          <p className="text-sm font-semibold text-clay">{message}</p>
        ) : null}

        {results.length ? (
          <div className="grid gap-3">
            {results.map((result) => (
              <button
                className="grid grid-cols-[64px_1fr_auto] items-center gap-4 rounded-inner border border-edge bg-canvas/60 p-3 text-left transition-colors hover:border-sage disabled:opacity-60 max-sm:grid-cols-[56px_1fr]"
                disabled={selectedGame?.igdbId === result.igdbId}
                key={result.igdbId}
                onClick={() => selectGame(result)}
                type="button"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-[6px] bg-sage-soft">
                  {result.coverUrl ? (
                    <Image
                      alt=""
                      className="object-cover"
                      fill
                      sizes="64px"
                      src={result.coverUrl}
                    />
                  ) : null}
                </div>
                <span className="min-w-0">
                  <span className="block font-display text-lg font-medium leading-tight">
                    {result.name}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-sm text-ink-soft">
                    {[getYear(result.releaseDate), result.platforms[0]]
                      .filter(Boolean)
                      .join(" / ") || t("manualSearch.catalogResult")}
                  </span>
                </span>
                <span className="rounded-pill border border-edge px-3 py-1 text-xs font-bold max-sm:col-span-2">
                  {selectedGame?.igdbId === result.igdbId
                    ? t("manualSearch.selected")
                    : t("manualSearch.add")}
                </span>
              </button>
            ))}
          </div>
        ) : query.trim().length >= 2 ? (
          <p className="text-sm text-ink-soft">{t("manualSearch.noMatches")}</p>
        ) : null}

        {selectedGame ? (
          <form action={addManualGameAction} className="grid gap-4 rounded-inner border border-edge bg-canvas/60 p-4">
            <input name="igdbId" type="hidden" value={selectedGame.igdbId} />
            <input name="title" type="hidden" value={selectedGame.name} />
            <input name="query" type="hidden" value={query} />
            <div>
              <p className="section-label !mb-1">{t("manualSearch.selected")}</p>
              <h3 className="font-display text-xl font-medium">
                {selectedGame.name}
              </h3>
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">{t("manualSearch.platform")}</span>
              <input
                className="min-h-11 rounded-inner border border-edge bg-surface px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                list="manual-game-platforms"
                name="platformName"
                onChange={(event) => setPlatformName(event.target.value)}
                placeholder={t("manualSearch.platformPlaceholder")}
                value={platformName}
              />
              <datalist id="manual-game-platforms">
                {selectedPlatformOptions.map((platform) => (
                  <option key={platform} value={platform} />
                ))}
              </datalist>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">{t("manualSearch.status")}</span>
              <select
                className="min-h-11 rounded-inner border border-edge bg-surface px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                name="status"
                onChange={(event) =>
                  setStatus(
                    event.target.value as (typeof statusOptions)[number]["value"],
                  )
                }
                value={status}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit">{t("manualSearch.addToShelf")}</Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

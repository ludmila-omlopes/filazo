"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type BuyDecision = {
  verdict: "BUY_NOW" | "WAIT_FOR_SALE" | "WISHLIST_ONLY" | "SKIP_FOR_NOW";
  confidence: number;
  reasons: string[];
  risks: string[];
  suggestedTrigger?: string;
};

type SearchResult = {
  igdbId: number;
  name: string;
  coverUrl: string | null;
  releaseDate: string | null;
  platforms: string[];
  genres: string[];
};

const verdictLabels: Record<BuyDecision["verdict"], string> = {
  BUY_NOW: "Bring it home",
  WAIT_FOR_SALE: "Wait for sale",
  WISHLIST_ONLY: "Stay curious",
  SKIP_FOR_NOW: "Maybe later",
};

const inputClassName =
  "rounded-inner border border-edge bg-surface px-3 py-2 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2";

function getYear(value: string | null) {
  return value ? new Date(value).getFullYear() : null;
}

export function BuyDecisionForm() {
  const [title, setTitle] = useState("");
  const [platformName, setPlatformName] = useState("");
  const [priceText, setPriceText] = useState("");
  const [genres, setGenres] = useState("");
  const [reasonUserWantsIt, setReasonUserWantsIt] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedGame, setSelectedGame] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [decision, setDecision] = useState<BuyDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedPlatformOptions = useMemo(
    () => selectedGame?.platforms.slice(0, 8) ?? [],
    [selectedGame],
  );

  useEffect(() => {
    const query = title.trim();
    if (query.length < 2) {
      return;
    }

    if (selectedGame?.name === query) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsSearching(true);
      fetch(`/api/profile/game-search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Game search is unavailable.");
          }
          return response.json() as Promise<{ results: SearchResult[] }>;
        })
        .then((payload) => {
          setResults(payload.results);
          setSearchMessage(
            payload.results.length ? null : "No catalog suggestions yet.",
          );
        })
        .catch((searchError) => {
          if (controller.signal.aborted) {
            return;
          }
          setSearchMessage(
            searchError instanceof Error
              ? searchError.message
              : "Game search is unavailable.",
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
  }, [selectedGame, title]);

  function selectGame(result: SearchResult) {
    setSelectedGame(result);
    setTitle(result.name);
    setPlatformName(result.platforms[0] ?? platformName);
    setGenres(result.genres.slice(0, 4).join(", "));
    setIsSearching(false);
    setResults([]);
    setSearchMessage(null);
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setDecision(null);
        startTransition(async () => {
          const response = await fetch("/api/assistant/buy-decision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              platformName: platformName || undefined,
              priceText: priceText || undefined,
              reasonUserWantsIt: reasonUserWantsIt || undefined,
              genres: genres
                .split(",")
                .map((genre) => genre.trim())
                .filter(Boolean),
            }),
          });
          const payload = await response.json();
          if (!response.ok) {
            setError(payload.error ?? "This purchase needs another look.");
            return;
          }
          setDecision(payload.decision);
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <label className="relative grid gap-1.5 text-sm font-semibold">
          Title
          <input
            autoComplete="off"
            className={inputClassName}
            name="title"
            onChange={(event) => {
              const nextTitle = event.target.value;
              setTitle(nextTitle);
              setSelectedGame(null);
              if (nextTitle.trim().length < 2) {
                setResults([]);
                setIsSearching(false);
                setSearchMessage(null);
              }
            }}
            required
            value={title}
          />
          {isSearching ? (
            <span className="absolute bottom-2 right-3 text-xs text-ink-soft">
              Searching
            </span>
          ) : null}
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          Price
          <input
            className={inputClassName}
            name="priceText"
            onChange={(event) => setPriceText(event.target.value)}
            placeholder="$19.99"
            value={priceText}
          />
        </label>
      </div>
      {results.length ? (
        <div className="grid gap-2 rounded-inner border border-edge bg-surface p-2">
          {results.slice(0, 5).map((result) => (
            <button
              className="grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-inner border border-edge bg-canvas/60 p-2 text-left hover:border-sage max-sm:grid-cols-[42px_1fr]"
              key={result.igdbId}
              onClick={() => selectGame(result)}
              type="button"
            >
              <span className="relative aspect-[3/4] overflow-hidden rounded-[5px] bg-sage-soft">
                {result.coverUrl ? (
                  <Image
                    alt=""
                    className="object-cover"
                    fill
                    sizes="42px"
                    src={result.coverUrl}
                  />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {result.name}
                </span>
                <span className="block truncate text-xs text-ink-soft">
                  {[getYear(result.releaseDate), result.platforms[0]]
                    .filter(Boolean)
                    .join(" / ") || "Game search result"}
                </span>
              </span>
              <span className="rounded-pill border border-edge px-2 py-1 text-xs font-bold max-sm:hidden">
                Use
              </span>
            </button>
          ))}
        </div>
      ) : searchMessage && title.trim().length >= 2 ? (
        <p className="text-xs font-semibold text-ink-soft" aria-live="polite">
          {searchMessage}
        </p>
      ) : null}
      {selectedGame ? (
        <p className="rounded-inner border border-edge bg-sage-soft p-3 text-sm font-semibold">
          Selected: {selectedGame.name}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <label className="grid gap-1.5 text-sm font-semibold">
          Platform
          <input
            className={inputClassName}
            list="buy-decision-platforms"
            name="platformName"
            onChange={(event) => setPlatformName(event.target.value)}
            placeholder="Steam"
            value={platformName}
          />
          <datalist id="buy-decision-platforms">
            {selectedPlatformOptions.map((platform) => (
              <option key={platform} value={platform} />
            ))}
          </datalist>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          Genres
          <input
            className={inputClassName}
            name="genres"
            onChange={(event) => setGenres(event.target.value)}
            placeholder="RPG, Strategy"
            value={genres}
          />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-semibold">
        Why do you want it?
        <textarea
          className={`min-h-20 ${inputClassName}`}
          name="reasonUserWantsIt"
          onChange={(event) => setReasonUserWantsIt(event.target.value)}
          placeholder="A friend recommended it, it is on sale, or it fits the mood."
          value={reasonUserWantsIt}
        />
      </label>
      <Button className="justify-self-start" disabled={isPending} loading={isPending}>
        {isPending ? "Thinking it over..." : "Help me decide"}
      </Button>

      {error ? (
        <div className="rounded-inner border border-edge bg-clay-soft p-4 text-sm font-semibold">
          {error}
        </div>
      ) : null}

      {decision ? (
        <div className="rounded-card border border-edge bg-sand-soft p-5 shadow-rest">
          <div className="flex items-center justify-between gap-3">
            <strong className="font-display text-xl">
              {verdictLabels[decision.verdict]}
            </strong>
            <span className="pill">{decision.confidence}% fit</span>
          </div>
          <ul className="mt-3 grid gap-1.5 text-sm leading-relaxed">
            {decision.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {decision.risks.length ? (
            <p className="mt-3 text-sm text-ink-soft">
              Worth knowing: {decision.risks.join(" ")}
            </p>
          ) : null}
          {decision.suggestedTrigger ? (
            <p className="mt-3 text-sm font-semibold">
              When to revisit: {decision.suggestedTrigger}
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

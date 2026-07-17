"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "@/components/locale-provider";
import { SafeImage } from "@/components/safe-image";
import { Button } from "@/components/ui/button";
import type { TranslationKey } from "@/lib/i18n";

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

const inputClassName =
  "rounded-inner border border-edge bg-surface px-3 py-2 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2";

const verdictLabelKeys = {
  BUY_NOW: "assistant.buyDecision.verdict.BUY_NOW",
  WAIT_FOR_SALE: "assistant.buyDecision.verdict.WAIT_FOR_SALE",
  WISHLIST_ONLY: "assistant.buyDecision.verdict.WISHLIST_ONLY",
  SKIP_FOR_NOW: "assistant.buyDecision.verdict.SKIP_FOR_NOW",
} satisfies Record<BuyDecision["verdict"], TranslationKey>;

function getYear(value: string | null) {
  return value ? new Date(value).getFullYear() : null;
}

export function BuyDecisionForm() {
  const locale = useLocale();
  const t = useTranslations();
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
            throw new Error(t("assistant.buyDecision.searchUnavailable"));
          }
          return response.json() as Promise<{ results: SearchResult[] }>;
        })
        .then((payload) => {
          setResults(payload.results);
          setSearchMessage(
            payload.results.length
              ? null
              : t("assistant.buyDecision.noSuggestions"),
          );
        })
        .catch((searchError) => {
          if (controller.signal.aborted) {
            return;
          }
          setSearchMessage(
            searchError instanceof Error
              ? searchError.message
              : t("assistant.buyDecision.searchUnavailable"),
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
  }, [selectedGame, t, title]);

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
              locale,
              genres: genres
                .split(",")
                .map((genre) => genre.trim())
                .filter(Boolean),
            }),
          });
          const payload = await response.json();
          if (!response.ok) {
            setError(
              payload.error ?? t("assistant.buyDecision.genericError"),
            );
            return;
          }
          setDecision(payload.decision);
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <label className="relative grid gap-1.5 text-sm font-semibold">
          {t("assistant.buyDecision.titleLabel")}
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
              {t("assistant.buyDecision.searching")}
            </span>
          ) : null}
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          {t("assistant.buyDecision.priceLabel")}
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
                  <SafeImage
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
                    .join(" / ") || t("assistant.buyDecision.searchResult")}
                </span>
              </span>
              <span className="rounded-pill border border-edge px-2 py-1 text-xs font-bold max-sm:hidden">
                {t("assistant.buyDecision.useResult")}
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
          {t("assistant.buyDecision.selected", { game: selectedGame.name })}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <label className="grid gap-1.5 text-sm font-semibold">
          {t("assistant.buyDecision.platformLabel")}
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
          {t("assistant.buyDecision.genresLabel")}
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
        {t("assistant.buyDecision.reasonLabel")}
        <textarea
          className={`min-h-20 ${inputClassName}`}
          name="reasonUserWantsIt"
          onChange={(event) => setReasonUserWantsIt(event.target.value)}
          placeholder={t("assistant.buyDecision.reasonPlaceholder")}
          value={reasonUserWantsIt}
        />
      </label>
      <Button className="justify-self-start" disabled={isPending} loading={isPending}>
        {isPending
          ? t("assistant.buyDecision.pending")
          : t("assistant.buyDecision.submit")}
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
              {t(verdictLabelKeys[decision.verdict])}
            </strong>
            <span className="pill">
              {t("assistant.buyDecision.fit", {
                confidence: decision.confidence,
              })}
            </span>
          </div>
          <ul className="mt-3 grid gap-1.5 text-sm leading-relaxed">
            {decision.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {decision.risks.length ? (
            <p className="mt-3 text-sm text-ink-soft">
              {t("assistant.buyDecision.worthKnowing", {
                risks: decision.risks.join(" "),
              })}
            </p>
          ) : null}
          {decision.suggestedTrigger ? (
            <p className="mt-3 text-sm font-semibold">
              {t("assistant.buyDecision.revisit", {
                trigger: decision.suggestedTrigger,
              })}
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

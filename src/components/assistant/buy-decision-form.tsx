"use client";

import { useState, useTransition } from "react";

type BuyDecision = {
  verdict: "BUY_NOW" | "WAIT_FOR_SALE" | "WISHLIST_ONLY" | "SKIP_FOR_NOW";
  confidence: number;
  reasons: string[];
  risks: string[];
  suggestedTrigger?: string;
};

const verdictLabels: Record<BuyDecision["verdict"], string> = {
  BUY_NOW: "Buy now",
  WAIT_FOR_SALE: "Wait for sale",
  WISHLIST_ONLY: "Wishlist only",
  SKIP_FOR_NOW: "Skip for now",
};

const inputClassName =
  "rounded-inner border border-edge bg-paper px-3 py-2 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2";

export function BuyDecisionForm() {
  const [decision, setDecision] = useState<BuyDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setError(null);
        setDecision(null);
        startTransition(async () => {
          const response = await fetch("/api/assistant/buy-decision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: formData.get("title"),
              platformName: formData.get("platformName") || undefined,
              priceText: formData.get("priceText") || undefined,
              reasonUserWantsIt:
                formData.get("reasonUserWantsIt") || undefined,
              genres: String(formData.get("genres") ?? "")
                .split(",")
                .map((genre) => genre.trim())
                .filter(Boolean),
            }),
          });
          const payload = await response.json();
          if (!response.ok) {
            setError(payload.error ?? "Could not evaluate this purchase.");
            return;
          }
          setDecision(payload.decision);
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <label className="grid gap-1.5 text-sm font-semibold">
          Title
          <input className={inputClassName} name="title" required />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          Price
          <input className={inputClassName} name="priceText" placeholder="$19.99" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <label className="grid gap-1.5 text-sm font-semibold">
          Platform
          <input className={inputClassName} name="platformName" placeholder="Steam" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          Genres
          <input className={inputClassName} name="genres" placeholder="RPG, Strategy" />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-semibold">
        Why do you want it?
        <textarea
          className={`min-h-20 ${inputClassName}`}
          name="reasonUserWantsIt"
          placeholder="A friend recommended it, it is on sale, or it fits the mood."
        />
      </label>
      <button className="btn btn-primary justify-self-start" disabled={isPending}>
        {isPending ? "Thinking it over..." : "Help me decide"}
      </button>

      {error ? (
        <div className="rounded-inner border border-edge bg-clay-soft p-4 text-sm font-semibold">
          {error}
        </div>
      ) : null}

      {decision ? (
        <div className="rounded-card border border-edge bg-sand-soft p-5 shadow-hard-xs">
          <div className="flex items-center justify-between gap-3">
            <strong className="font-display text-xl">
              {verdictLabels[decision.verdict]}
            </strong>
            <span className="pill">{decision.confidence}% confidence</span>
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

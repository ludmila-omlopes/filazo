import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatusDisplayLabel } from "@/lib/copy";
import type { Locale } from "@/lib/i18n";

const statusStyles: Record<string, string> = {
  OWNED: "bg-sage-soft text-ink",
  WISHLIST: "bg-sand-soft text-ink",
  PLAYING: "bg-sky-soft text-ink",
  PAUSED: "bg-canvas text-ink-soft",
  COMPLETED: "bg-fern-soft text-ink",
  FINISHED: "bg-fern-soft text-ink",
  BACKLOG: "bg-canvas text-ink-soft",
  DROPPED: "bg-clay-soft text-ink",
};

/** Soft tinted badge for a UserGameEntry status (game detail + dev showcase). */
export function StatusBadge({
  status,
  className,
  locale = "en",
}: {
  status: string;
  className?: string;
  locale?: Locale;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-pill px-2.5 py-0.5 text-caption font-bold lowercase",
        "border border-edge",
        statusStyles[status] ?? "bg-canvas text-ink-soft",
        className,
      )}
    >
      {getStatusDisplayLabel(status, locale)}
    </span>
  );
}

// Vivid per-status text colors (deep on day, bright on night — see globals.css).
// Passive states (owned/backlog/paused) stay muted; the row carries their tone.
const statusLabelStyles: Record<string, string> = {
  PLAYING: "text-sky-strong",
  WISHLIST: "text-sand-strong",
  COMPLETED: "text-fern-strong",
  FINISHED: "text-fern-strong",
  DROPPED: "text-clay-strong",
};

/**
 * Text-only status label for the catalog. The status hue is carried by the row
 * (see {@link catalogRowAccent}) and echoed in the label color. Finished games
 * get a checkmark so completing something reads as a reward.
 */
export function StatusLabel({
  status,
  className,
  locale = "en",
}: {
  status: string;
  className?: string;
  locale?: Locale;
}) {
  const isFinished = status === "FINISHED" || status === "COMPLETED";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-caption font-bold uppercase tracking-[0.12em]",
        statusLabelStyles[status] ?? "text-ink-soft",
        className,
      )}
    >
      {isFinished ? (
        <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />
      ) : null}
      {getStatusDisplayLabel(status, locale)}
    </span>
  );
}

/**
 * Catalog row/card accent for a status: a colored left spine plus a background
 * wash. Pair with `border-l-4`. Passive states (owned, backlog, paused) stay
 * neutral so a mostly-owned shelf reads calm; finished games get the strongest
 * wash so they stand out.
 */
const rowAccents: Record<string, string> = {
  PLAYING: "border-l-sky bg-sky-soft/80",
  WISHLIST: "border-l-sand bg-sand-soft/70",
  COMPLETED: "border-l-fern bg-fern-soft/90",
  FINISHED: "border-l-fern bg-fern-soft/90",
  DROPPED: "border-l-clay bg-clay-soft/50",
};

export function catalogRowAccent(status: string | null | undefined): string {
  return (status && rowAccents[status]) || "border-l-edge";
}

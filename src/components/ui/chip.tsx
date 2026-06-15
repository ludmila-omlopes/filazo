import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small soft tag for genres, platforms, and metadata hints. */
export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "sage" | "blue" | "sand" | "lavender";
  className?: string;
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-canvas text-ink-soft",
    sage: "bg-sage-soft text-ink",
    blue: "bg-sky-soft text-ink",
    sand: "bg-sand-soft text-ink",
    lavender: "bg-dusk-lavender-soft text-ink",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border border-edge px-2.5 py-0.5 text-caption font-bold lowercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

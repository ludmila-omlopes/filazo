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
    neutral: "bg-bg text-ink-soft",
    sage: "bg-sage-soft text-ink",
    blue: "bg-blue-soft text-ink",
    sand: "bg-sand-soft text-ink",
    lavender: "bg-lavender-soft text-ink",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

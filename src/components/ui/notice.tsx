import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  success: "bg-sage-soft",
  error: "bg-clay-soft",
  info: "bg-blue-soft",
} as const;

/** Soft, tinted message banner for sync results, errors, and hints. */
export function Notice({
  tone = "info",
  className,
  children,
}: {
  tone?: keyof typeof tones;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "rounded-inner border border-edge px-5 py-4 text-sm font-semibold leading-relaxed animate-slide-in",
        tones[tone],
        className,
      )}
      role="status"
    >
      {children}
    </div>
  );
}

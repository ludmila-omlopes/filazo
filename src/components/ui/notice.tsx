import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  success: "bg-sage-soft",
  error: "bg-clay-soft",
  info: "bg-sky-soft",
  warning: "bg-sand-soft",
} as const;

/** Soft, tinted message banner for sync results, errors, and hints. */
export function Notice({
  tone = "info",
  className,
  icon,
  children,
}: {
  tone?: keyof typeof tones;
  className?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-inner border border-edge px-5 py-4 text-sm font-semibold leading-relaxed shadow-rest",
        tones[tone],
        className,
      )}
      role="status"
    >
      {icon ? <span className="mt-0.5 flex-none text-ink-soft">{icon}</span> : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

import type { ReactNode } from "react";

/** Gentle empty placeholder — reassuring instead of alarming. */
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-edge bg-paper/70 p-8 text-center">
      <p className="font-display text-lg">{title}</p>
      {children ? (
        <div className="mx-auto mt-2 max-w-[44ch] text-sm leading-relaxed text-ink-soft">
          {children}
        </div>
      ) : null}
    </div>
  );
}

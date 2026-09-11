import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Calm section intro: small eyebrow label, a quiet display heading, and an
 * optional aside (action button or pill) that wraps below on small screens.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  aside,
  inlineAside = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  /** Keep a compact action, such as an icon menu, beside the heading on mobile. */
  inlineAside?: boolean;
}) {
  return (
    <div className={cn("mb-6 flex justify-between gap-4", inlineAside ? "items-start" : "items-end max-lg:flex-col max-lg:items-start")}>
      <div className="min-w-0">
        {eyebrow ? <span className="section-label">{eyebrow}</span> : null}
        <h2 className="text-section-title leading-snug">{title}</h2>
        {description ? (
          <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      {aside ? <div className={cn("flex-none", !inlineAside && "max-lg:w-full")}>{aside}</div> : null}
    </div>
  );
}

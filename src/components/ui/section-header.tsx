import type { ReactNode } from "react";

/**
 * Calm section intro: small eyebrow label, a quiet display heading, and an
 * optional aside (action button or pill) that wraps below on small screens.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 max-lg:flex-col max-lg:items-start">
      <div className="min-w-0">
        {eyebrow ? <span className="section-label">{eyebrow}</span> : null}
        <h2 className="text-section-title leading-snug">{title}</h2>
        {description ? (
          <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      {aside ? <div className="flex-none max-lg:w-full">{aside}</div> : null}
    </div>
  );
}

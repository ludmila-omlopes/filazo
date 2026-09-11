"use client";

import { Tabs } from "radix-ui";
import type { ReactNode } from "react";

export function GuideSections({
  label,
  sections,
}: {
  label: string;
  sections: { id: string; label: string; content: ReactNode }[];
}) {
  return (
    <Tabs.Root defaultValue="suggestions" className="grid min-w-0 gap-6">
      <Tabs.List aria-label={label} className="grid grid-cols-3 gap-1 border-b border-edge pb-2 sm:flex sm:flex-wrap">
        {sections.map((section) => (
          <Tabs.Trigger
            key={section.id}
            value={section.id}
            className="min-h-11 min-w-0 rounded-inner px-2 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-rest max-sm:text-xs sm:px-4"
          >
            {section.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {sections.map((section) => (
        <Tabs.Content
          key={section.id}
          value={section.id}
          forceMount
          className="grid min-w-0 gap-6 outline-none focus-visible:ring-2 focus-visible:ring-sage data-[state=inactive]:hidden"
        >
          {section.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

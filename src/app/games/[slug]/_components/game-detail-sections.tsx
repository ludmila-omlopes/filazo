"use client";

import { Tabs } from "radix-ui";
import type { ReactNode } from "react";

export function GameDetailSections({
  label,
  sections,
}: {
  label: string;
  sections: Array<{ id: string; label: string; content: ReactNode }>;
}) {
  return (
    <Tabs.Root defaultValue="about" className="grid min-w-0 gap-6">
      <Tabs.List
        aria-label={label}
        className="flex flex-wrap gap-2 border-b border-edge pb-3"
      >
        {sections.map((section) => (
          <Tabs.Trigger
            key={section.id}
            value={section.id}
            className="min-h-11 rounded-inner px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-rest"
          >
            {section.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {sections.map((section) => (
        <Tabs.Content
          forceMount
          key={section.id}
          value={section.id}
          className="grid min-w-0 gap-6 outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=inactive]:hidden"
        >
          {section.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

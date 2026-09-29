"use client";

import { Tabs } from "radix-ui";
import { useState, type ReactNode } from "react";

const DEFAULT_SECTION = "about";

export function GameDetailSections({
  label,
  sections,
}: {
  label: string;
  /** `deferred` sections mount on first open, keeping third-party text out of the initial page. */
  sections: Array<{ id: string; label: string; content: ReactNode; deferred?: boolean }>;
}) {
  const [active, setActive] = useState(DEFAULT_SECTION);
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set([DEFAULT_SECTION]));

  function open(value: string) {
    setActive(value);
    setOpened((current) => (current.has(value) ? current : new Set(current).add(value)));
  }

  return (
    <Tabs.Root value={active} onValueChange={open} className="grid min-w-0 gap-6">
      {/* One scrollable row: wrapped tabs on a phone read as a pile of
          buttons and push the content down. */}
      <Tabs.List
        aria-label={label}
        className="-mx-1 flex gap-2 overflow-x-auto border-b border-edge px-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sections.map((section) => (
          <Tabs.Trigger
            key={section.id}
            value={section.id}
            className="min-h-11 flex-none whitespace-nowrap rounded-inner px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-rest"
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
          {!section.deferred || opened.has(section.id) ? section.content : null}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

export type JournalDraft = {
  title: string;
  body: string;
  occurredAt: string;
};

export function useJournalDraft(key: string, initial?: JournalDraft) {
  const [draft, setDraft] = useState<JournalDraft>(
    initial ?? { title: "", body: "", occurredAt: "" },
  );
  const [savedLocally, setSavedLocally] = useState(false);
  const [ready, setReady] = useState(false);
  const initialRef = useRef(initial);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let restored = initialRef.current ?? {
        title: "",
        body: "",
        occurredAt: "",
      };
      // An existing page arrives as an ISO date; the visible input uses local time.
      if (restored.occurredAt) {
        const date = new Date(restored.occurredAt);
        restored = {
          ...restored,
          occurredAt: new Date(
            date.getTime() - date.getTimezoneOffset() * 60_000,
          )
            .toISOString()
            .slice(0, 16),
        };
      }
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const value: unknown = JSON.parse(raw);
          if (
            value &&
            typeof value === "object" &&
            "title" in value &&
            typeof value.title === "string" &&
            "body" in value &&
            typeof value.body === "string" &&
            "occurredAt" in value &&
            typeof value.occurredAt === "string"
          ) {
            restored = {
              title: value.title.slice(0, 160),
              body: value.body.slice(0, 4000),
              occurredAt: value.occurredAt,
            };
            setSavedLocally(true);
          }
        }
      } catch {
        /* Storage may be unavailable; the form still works in memory. */
      }
      setDraft((current) =>
        current.title === restored.title &&
        current.body === restored.body &&
        current.occurredAt === restored.occurredAt
          ? current
          : restored,
      );
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key]);

  function updateDraft(patch: Partial<JournalDraft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    try {
      if (!next.title && !next.body && !next.occurredAt && !initial) {
        localStorage.removeItem(key);
        setSavedLocally(false);
        return;
      }
      localStorage.setItem(key, JSON.stringify(next));
      setSavedLocally(true);
    } catch {
      setSavedLocally(false);
    }
  }

  return { draft, updateDraft, savedLocally, ready };
}

"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "@/components/locale-provider";

const DISCORD_INVITE = "https://discord.gg/38Y4zTVSr";
const DISMISS_KEY = "filazo-beta-banner-dismissed";
const BANNER_CLASS = "has-beta-banner";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

// Same-tab writes don't fire the "storage" event, so notify subscribers by hand.
function emitDismissed() {
  for (const listener of listeners) {
    listener();
  }
}

function getSnapshot() {
  return localStorage.getItem(DISMISS_KEY) === "1";
}

function getServerSnapshot() {
  return false;
}

/**
 * Fixed top strip inviting beta testers to Discord. The layout renders
 * `has-beta-banner` on <html> so first paint already reserves the strip's
 * height; dismissing removes both the strip and that reserved space, and the
 * choice is remembered in localStorage. Reading it through
 * useSyncExternalStore keeps hydration clean (server always shows the strip)
 * without a setState-in-effect.
 */
export function BetaBanner() {
  const t = useTranslations();
  const dismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    document.documentElement.classList.toggle(BANNER_CLASS, !dismissed);
  }, [dismissed]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "1");
    emitDismissed();
  }, []);

  if (dismissed) {
    return null;
  }

  return (
    <div className="beta-banner fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-x-2 gap-y-1 border-b border-edge bg-surface/95 px-4 text-sm backdrop-blur-md max-sm:text-xs">
      <p className="truncate">
        <span className="font-semibold">{t("banner.beta.message")}</span>{" "}
        <a
          href={DISCORD_INVITE}
          target="_blank"
          rel="noreferrer"
          className="nav-link font-semibold underline underline-offset-2"
        >
          {t("banner.beta.cta")}
        </a>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("banner.beta.dismiss")}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-lg leading-none text-ink-soft transition-colors hover:text-ink"
      >
        &times;
      </button>
    </div>
  );
}

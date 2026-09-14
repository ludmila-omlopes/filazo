"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import type { AdSenseConfig } from "@/lib/adsense";

declare global {
  interface Window {
    adsbygoogle?: { push: (ad: Record<string, never>) => unknown };
  }
}

export function AdSenseSlot({ publisherId, slotId, testMode, label }: AdSenseConfig & { label: string }) {
  const elementRef = useRef<HTMLModElement>(null);
  const requested = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!ready || failed || !element) return;

    const requestAd = () => {
      // React Strict Mode and script re-mounts must not request the same slot twice.
      if (requested.current || element.dataset.adsbygoogleStatus || !element.isConnected || element.getBoundingClientRect().width <= 0) return;
      requested.current = true;
      try {
        const queue = window.adsbygoogle ?? new Array<Record<string, never>>();
        window.adsbygoogle = queue;
        queue.push({});
      } catch {
        setFailed((current) => current ? current : true);
      }
    };

    // Wait until the slot has a width, including when a tab becomes visible.
    const observer = new ResizeObserver(requestAd);
    observer.observe(element);
    const frame = requestAnimationFrame(requestAd);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ready, failed]);

  if (failed) return null;

  return (
    <aside aria-label={label} className="adsense-banner grid w-full min-w-0 gap-2 border-t border-edge pt-4">
      <p className="text-center text-xs text-ink-soft">{label}</p>
      <ins
        ref={elementRef}
        className="adsbygoogle block min-h-[100px] w-full"
        style={{ display: "block" }}
        data-ad-client={publisherId}
        data-ad-slot={slotId}
        data-ad-format="horizontal"
        data-full-width-responsive="false"
        data-adtest={testMode ? "on" : undefined}
      />
      <Script
        id="filazo-adsense"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`}
        crossOrigin="anonymous"
        strategy="lazyOnload"
        onReady={() => setReady((current) => current ? current : true)}
        onError={() => setFailed((current) => current ? current : true)}
      />
    </aside>
  );
}

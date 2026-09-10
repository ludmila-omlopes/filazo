"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function SyncMonitorRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}

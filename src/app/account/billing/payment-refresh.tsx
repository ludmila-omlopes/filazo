"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PaymentRefresh({ waiting }: { waiting: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!waiting) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      router.refresh();
      if (++attempts >= 10) window.clearInterval(timer);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [waiting, router]);
  return null;
}

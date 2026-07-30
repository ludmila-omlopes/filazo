"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function SiteHeaderFrame({ children }: { children: React.ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateScrolled = () => setIsScrolled(window.scrollY > 8);

    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });

    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

  return (
    <header
      className={cn(
        "site-header sticky top-3 z-40 mx-auto mb-8 flex w-full max-w-[1100px] items-center justify-between gap-4 rounded-card border border-transparent px-4 py-3 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 max-lg:mb-5 max-lg:min-h-14 max-lg:px-3 max-lg:py-1.5",
        isScrolled &&
          "border-edge bg-surface/85 shadow-rest backdrop-blur-md",
      )}
    >
      {children}
    </header>
  );
}

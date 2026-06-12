"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ScreenshotLightboxProps = {
  screenshots: string[];
  gameName: string;
};

export function ScreenshotLightbox({
  screenshots,
  gameName,
}: ScreenshotLightboxProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isOpen = openIndex !== null;

  const close = useCallback(() => setOpenIndex(null), []);

  const goTo = useCallback(
    (direction: "prev" | "next") => {
      setOpenIndex((current) => {
        if (current === null) return null;
        if (direction === "prev") {
          return current === 0 ? screenshots.length - 1 : current - 1;
        }
        return current === screenshots.length - 1 ? 0 : current + 1;
      });
    },
    [screenshots.length],
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") goTo("prev");
      if (event.key === "ArrowRight") goTo("next");
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, close, goTo]);

  return (
    <>
      {/* Thumbnail grid */}
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        {screenshots.slice(0, 6).map((screenshot, index) => (
          <button
            className={cn(
              "overflow-hidden rounded-inner border border-edge aspect-video bg-canvas cursor-pointer group relative",
              "hover:shadow-lift transition-[box-shadow] duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2",
              index === 0 &&
                screenshots.length > 2 &&
                "col-span-2 max-sm:col-span-1",
            )}
            key={screenshot}
            onClick={() => setOpenIndex(index)}
            type="button"
            aria-label={`View screenshot ${index + 1} of ${gameName} fullscreen`}
          >
            <img
              alt={`Screenshot ${index + 1} of ${gameName}`}
              src={screenshot}
              className="w-full h-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
            />
            {/* Zoom hint overlay */}
            <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/20 transition-colors duration-200 grid place-items-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-ink/70 text-white rounded-full p-2.5 backdrop-blur-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
                  />
                </svg>
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox modal */}
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/90 backdrop-blur-md motion-safe:animate-[fade-in_150ms_ease-out]"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Screenshot ${openIndex! + 1} of ${gameName}`}
        >
          {/* Close button */}
          <button
            className="absolute top-5 right-5 z-10 w-11 h-11 rounded-full bg-white/10 border-2 border-white/20 grid place-items-center text-white hover:bg-white/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={close}
            type="button"
            aria-label="Close lightbox"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Navigation: Previous */}
          {screenshots.length > 1 ? (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 border-2 border-white/20 grid place-items-center text-white hover:bg-white/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white max-sm:left-2 max-sm:w-9 max-sm:h-9"
              onClick={() => goTo("prev")}
              type="button"
              aria-label="Previous screenshot"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5L8.25 12l7.5-7.5"
                />
              </svg>
            </button>
          ) : null}

          {/* Navigation: Next */}
          {screenshots.length > 1 ? (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 border-2 border-white/20 grid place-items-center text-white hover:bg-white/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white max-sm:right-2 max-sm:w-9 max-sm:h-9"
              onClick={() => goTo("next")}
              type="button"
              aria-label="Next screenshot"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.25 4.5l7.5 7.5-7.5 7.5"
                />
              </svg>
            </button>
          ) : null}

          {/* Image container */}
          <div className="relative max-w-[90vw] max-h-[85vh] flex items-center justify-center">
            <img
              alt={`Screenshot ${openIndex! + 1} of ${gameName}`}
              src={screenshots[openIndex!]}
              className="max-w-full max-h-[85vh] object-contain rounded-[12px] shadow-float motion-safe:animate-[scale-in_200ms_ease-out]"
            />
          </div>

          {/* Counter */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold tracking-wide backdrop-blur-sm">
            {openIndex! + 1} / {screenshots.length}
          </div>
        </div>
      ) : null}
    </>
  );
}

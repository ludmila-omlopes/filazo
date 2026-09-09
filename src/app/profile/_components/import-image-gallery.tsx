"use client";

import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SafeImage } from "@/components/safe-image";
import type { ImportSourceImage } from "@/lib/import-audit";

type ImportImageGalleryProps = {
  closeLabel: string;
  imageLabel: string;
  images: ImportSourceImage[];
  nextLabel: string;
  openLabel: string;
  previousLabel: string;
};

function withIndex(label: string, index: number) {
  return label.replace("{index}", String(index + 1));
}

export function ImportImageGallery({
  closeLabel,
  imageLabel,
  images,
  nextLabel,
  openLabel,
  previousLabel,
}: ImportImageGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const close = useCallback(() => setOpenIndex(null), []);
  const goTo = useCallback(
    (direction: -1 | 1) => {
      setOpenIndex((current) => {
        if (current === null) return null;
        return (current + direction + images.length) % images.length;
      });
    },
    [images.length],
  );

  useEffect(() => {
    if (openIndex === null) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") goTo(-1);
      if (event.key === "ArrowRight") goTo(1);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [close, goTo, openIndex]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        {images.map((image, index) => (
          <button
            aria-label={withIndex(openLabel, index)}
            className="group relative aspect-[4/3] cursor-zoom-in overflow-hidden rounded-inner border border-edge bg-canvas transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            key={image.url}
            onClick={() => setOpenIndex(index)}
            type="button"
          >
            <SafeImage
              alt={image.fileName ?? withIndex(imageLabel, index)}
              className="object-contain p-2"
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              src={image.url}
              unoptimized
            />
            <span className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-ink/75 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Expand aria-hidden className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>

      {openIndex !== null ? (
        <div
          aria-label={withIndex(imageLabel, openIndex)}
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-ink/90 p-5 backdrop-blur-md"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          role="dialog"
        >
          <button
            aria-label={closeLabel}
            className="absolute right-5 top-5 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={close}
            type="button"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>

          {images.length > 1 ? (
            <>
              <button
                aria-label={previousLabel}
                className="absolute left-4 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white max-sm:left-2"
                onClick={() => goTo(-1)}
                type="button"
              >
                <ChevronLeft aria-hidden className="h-5 w-5" />
              </button>
              <button
                aria-label={nextLabel}
                className="absolute right-4 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white max-sm:right-2"
                onClick={() => goTo(1)}
                type="button"
              >
                <ChevronRight aria-hidden className="h-5 w-5" />
              </button>
            </>
          ) : null}

          <div className="relative h-[85vh] w-[90vw]">
            <SafeImage
              alt={
                images[openIndex].fileName ?? withIndex(imageLabel, openIndex)
              }
              className="object-contain"
              fill
              sizes="90vw"
              src={images[openIndex].url}
              unoptimized
            />
          </div>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-pill border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
            {openIndex + 1} / {images.length}
          </div>
        </div>
      ) : null}
    </>
  );
}

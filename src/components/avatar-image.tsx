"use client";

import { useState } from "react";

/**
 * Profile photo with an initial as fallback. Provider avatars (Google, Steam)
 * are hotlinked, so they are requested without a referrer — Google's avatar
 * host rejects many cross-site referrers — and a failed load falls back to the
 * initial instead of showing the browser's broken-image alt text.
 */
export function AvatarImage({
  alt,
  className,
  name,
  src,
}: {
  alt: string;
  className?: string;
  name: string;
  src: string | null | undefined;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";

  if (!src || failedSource === src) {
    return <span aria-hidden="true">{initial}</span>;
  }

  return (
    // Hotlinked provider avatars are not in next/image's remote patterns.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={className}
      onError={() => setFailedSource(src)}
      referrerPolicy="no-referrer"
      src={src}
    />
  );
}

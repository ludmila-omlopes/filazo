"use client";

import Image, { type ImageProps } from "next/image";
import { useState, type ReactNode } from "react";
import { isAllowedImageUrl } from "@/lib/image-urls";

type SafeImageProps = Omit<ImageProps, "src"> & {
  fallback?: ReactNode;
  src: string;
};

export function SafeImage({
  alt,
  fallback = null,
  onError,
  src,
  ...props
}: SafeImageProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  if (!isAllowedImageUrl(src) || failedSource === src) {
    return fallback;
  }

  return (
    <Image
      {...props}
      alt={alt}
      onError={(event) => {
        setFailedSource((current) => (current === src ? current : src));
        onError?.(event);
      }}
      src={src}
    />
  );
}

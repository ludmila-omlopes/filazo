"use client";

import { RouteErrorState } from "@/components/route-error-state";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <RouteErrorState error={error} retry={retry} />;
}

"use client";

import { useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { createTranslator, type Locale } from "@/lib/i18n";
import { createProfileActionRunner } from "@/lib/profile-action-runner";

export function useProfileActionRecovery() {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<{ retry: () => Promise<void> } | null>(null);
  const [runner] = useState(() => createProfileActionRunner({
    onPending: setPending,
    onFailure: (next) => {
      setFailure(next);
      if (next) {
        // Keep diagnostics, without attaching the selected games or form contents.
        Sentry.captureException(next.error, { tags: { recovery: "profile-action" } });
      }
    },
  }));
  return { pending, failure, runner, retry: () => {
    if (failure) void runner.run(failure.retry);
  } };
}

export function ProfileActionRecovery({
  locale,
  pending,
  onRetry,
  search = false,
}: {
  locale: Locale;
  pending: boolean;
  onRetry: () => void;
  search?: boolean;
}) {
  const t = createTranslator(locale);
  const noticeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    noticeRef.current?.scrollIntoView({ block: "nearest" });
  }, []);
  return (
    <div className="mt-3 rounded-inner border border-edge bg-sand-soft p-4 text-sm" ref={noticeRef} role="alert">
      <p className="font-semibold">{t(search ? "profile.recovery.searchTitle" : "profile.recovery.title")}</p>
      <p className="mt-1 text-ink-soft">{t(search ? "profile.recovery.searchBody" : "profile.recovery.body")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {/* A document navigation can display the security checkpoint. Keep drafts in this tab. */}
        <a className="font-semibold underline underline-offset-4" href="/connection-check" target="_blank" rel="noopener noreferrer">
          {t("profile.recovery.verify")}
        </a>
        <Button disabled={pending} onClick={onRetry} size="sm" type="button" variant="secondary">
          {t("profile.recovery.retry")}
        </Button>
      </div>
    </div>
  );
}

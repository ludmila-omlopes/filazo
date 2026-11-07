"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// A pending sync refreshes the page while someone is looking at it. Hidden or
// untouched tabs stop refreshing, so a forgotten tab cannot keep the database
// awake; returning to the tab or interacting resumes right away.
const PENDING_REFRESH_MS = 5_000;
const IDLE_STOP_MS = 10 * 60_000;

type SyncActionFormProps = {
  action: (formData: FormData) => void;
  buttonLabel: string;
  pendingLabel: string;
  pendingNotice?: string;
  externallyPending?: boolean;
};

function SyncSubmitButton({
  buttonLabel,
  externallyPending,
  pendingLabel,
}: {
  buttonLabel: string;
  externallyPending: boolean;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  const isPending = pending || externallyPending;

  return (
    <Button
      type="submit"
      disabled={isPending}
      aria-disabled={isPending}
      loading={pending}
    >
      {isPending ? pendingLabel : buttonLabel}
    </Button>
  );
}

function SyncPendingNotice({
  externallyPending,
  message,
}: {
  externallyPending: boolean;
  message: string;
}) {
  const { pending } = useFormStatus();

  if (!pending && !externallyPending) {
    return null;
  }

  return (
    <p
      className="mt-2 rounded-inner border border-edge bg-sand-soft px-3 py-2 text-xs font-semibold leading-relaxed text-ink-soft"
      role="status"
      aria-live="polite"
    >
      {message}
    </p>
  );
}

export function SyncActionForm({
  action,
  buttonLabel,
  externallyPending = false,
  pendingLabel,
  pendingNotice,
}: SyncActionFormProps) {
  const router = useRouter();

  useEffect(() => {
    if (!externallyPending) {
      return;
    }

    let lastActivity = Date.now();
    const isVisible = () => document.visibilityState === "visible";
    const markActivity = () => {
      lastActivity = Date.now();
    };
    const resume = () => {
      if (!isVisible()) return;
      markActivity();
      router.refresh();
    };
    const intervalId = window.setInterval(() => {
      if (isVisible() && Date.now() - lastActivity <= IDLE_STOP_MS) {
        router.refresh();
      }
    }, PENDING_REFRESH_MS);
    const activityEvents = ["pointerdown", "pointermove", "keydown", "scroll"] as const;

    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    for (const event of activityEvents) {
      window.addEventListener(event, markActivity, { passive: true });
    }

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      for (const event of activityEvents) {
        window.removeEventListener(event, markActivity);
      }
    };
  }, [externallyPending, router]);

  return (
    <form action={action}>
      <SyncSubmitButton
        buttonLabel={buttonLabel}
        externallyPending={externallyPending}
        pendingLabel={pendingLabel}
      />
      {pendingNotice ? (
        <SyncPendingNotice
          externallyPending={externallyPending}
          message={pendingNotice}
        />
      ) : null}
    </form>
  );
}

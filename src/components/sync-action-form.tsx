"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type SyncActionFormProps = {
  action: (formData: FormData) => void;
  buttonLabel: string;
  pendingLabel: string;
  pendingNotice: string;
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

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 2_000);

    return () => window.clearInterval(intervalId);
  }, [externallyPending, router]);

  return (
    <form action={action}>
      <SyncSubmitButton
        buttonLabel={buttonLabel}
        externallyPending={externallyPending}
        pendingLabel={pendingLabel}
      />
      <SyncPendingNotice
        externallyPending={externallyPending}
        message={pendingNotice}
      />
    </form>
  );
}

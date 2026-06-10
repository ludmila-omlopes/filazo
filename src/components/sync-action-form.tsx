"use client";

import { useFormStatus } from "react-dom";

type SyncActionFormProps = {
  action: (formData: FormData) => void;
  buttonLabel: string;
  pendingLabel: string;
  pendingNotice: string;
};

function SyncSubmitButton({
  buttonLabel,
  pendingLabel,
}: {
  buttonLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="btn btn-primary disabled:opacity-70 disabled:cursor-wait disabled:shadow-none disabled:translate-y-0 disabled:translate-x-0"
      type="submit"
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? pendingLabel : buttonLabel}
    </button>
  );
}

function SyncPendingNotice({ message }: { message: string }) {
  const { pending } = useFormStatus();

  if (!pending) {
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
  pendingLabel,
  pendingNotice,
}: SyncActionFormProps) {
  return (
    <form action={action}>
      <SyncSubmitButton
        buttonLabel={buttonLabel}
        pendingLabel={pendingLabel}
      />
      <SyncPendingNotice message={pendingNotice} />
    </form>
  );
}

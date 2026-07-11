"use client";

import { useFormStatus } from "react-dom";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useJournalUploadPending } from "./journal-upload-context";

export function JournalSubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  const uploading = useJournalUploadPending();
  const isPending = pending || uploading;

  return (
    <Button
      aria-disabled={isPending}
      className="justify-self-start"
      loading={isPending}
      type="submit"
    >
      <PenLine aria-hidden="true" />
      {isPending ? pendingLabel : label}
    </Button>
  );
}

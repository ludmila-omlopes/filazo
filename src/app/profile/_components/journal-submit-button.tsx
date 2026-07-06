"use client";

import { useFormStatus } from "react-dom";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";

export function JournalSubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-disabled={pending}
      className="justify-self-start"
      loading={pending}
      type="submit"
    >
      <PenLine aria-hidden="true" />
      {pending ? pendingLabel : label}
    </Button>
  );
}

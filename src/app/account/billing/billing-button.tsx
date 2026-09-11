"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function BillingButton({ children, pendingLabel, disabled = false }: {
  children: React.ReactNode; pendingLabel: string; disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={disabled || pending} aria-busy={pending}>
    {pending ? pendingLabel : children}
  </Button>;
}

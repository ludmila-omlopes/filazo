"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
export function CalendarSubmit({ children, disabled = false }: { children: React.ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <Button size="sm" type="submit" disabled={disabled || pending} aria-busy={pending}>{children}</Button>;
}

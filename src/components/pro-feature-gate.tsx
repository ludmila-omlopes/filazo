import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { planCopy } from "@/lib/plan-copy";
import type { Locale } from "@/lib/i18n";

export function ProFeatureGate({ title, description, locale }: { title: string; description: string; locale: Locale }) {
  return <section className="grid justify-items-start gap-4 rounded-card border border-edge bg-surface p-6">
    <span className="flex items-center gap-2 text-sm text-ink-soft"><LockKeyhole className="size-4" />Pro</span>
    <h2 className="font-display text-2xl">{title}</h2>
    <p className="max-w-[55ch] text-sm leading-relaxed text-ink-soft">{description}</p>
    <Button asChild><Link href="/account/billing">{planCopy(locale).upgrade}</Link></Button>
  </section>;
}

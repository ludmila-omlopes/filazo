"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { Popover } from "radix-ui";
import type { ReactNode } from "react";
import { AvatarImage } from "./avatar-image";
import { useTranslations } from "./locale-provider";

/**
 * Desktop account entry: one button with the person's name that opens plan
 * and sign-out, instead of three separate items in the navigation row.
 */
export function AccountMenu({
  avatarUrl,
  displayName,
  signOut,
}: {
  avatarUrl: string | null | undefined;
  displayName: string;
  /** Server-rendered sign-out form. */
  signOut: ReactNode;
}) {
  const t = useTranslations();

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          aria-label={t("nav.openAccountMenu")}
          className="inline-flex min-h-10 max-w-[18rem] cursor-pointer items-center gap-2 rounded-pill border border-edge bg-surface py-1 pl-1 pr-3 text-sm font-semibold text-ink shadow-rest transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
          type="button"
        >
          <span className="grid h-8 w-8 flex-none place-items-center overflow-hidden rounded-pill bg-dusk-deep font-display text-sm text-cream">
            <AvatarImage
              alt=""
              className="h-full w-full object-cover"
              name={displayName}
              src={avatarUrl}
            />
          </span>
          <span className="min-w-0 truncate">{displayName}</span>
          <ChevronDown aria-hidden className="h-4 w-4 flex-none text-ink-soft" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          className="z-50 grid min-w-52 gap-1 rounded-card border border-edge bg-surface p-2 text-ink shadow-float"
          sideOffset={8}
        >
          <p className="truncate px-3 pb-1 pt-2 text-caption font-bold uppercase tracking-[0.12em] text-ink-soft">
            {t("nav.account")}
          </p>
          <Popover.Close asChild>
            <Link
              className="flex min-h-10 items-center rounded-inner px-3 text-sm font-semibold transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href="/account/billing"
            >
              {t("billing.title")}
            </Link>
          </Popover.Close>
          <div className="border-t border-edge pt-1 [&_button]:w-full [&_button]:justify-start">
            {signOut}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

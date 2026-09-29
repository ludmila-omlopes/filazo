"use client";

import { BookOpen, Disc3, Heart, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createTranslator, type Locale } from "@/lib/i18n";
import { toggleFavoriteAction, togglePhysicalCopyAction } from "../actions";

type EntryFlags = { isFavorite: boolean; isPhysicalCopy: boolean };

/**
 * Secondary per-game actions for a catalog row, kept inside the row behind one
 * "more" button instead of loose icon buttons below every card. Status changes
 * and removal stay in the "Edit shelf" mode.
 */
export function ShelfEntryMenu({
  entryId,
  gameName,
  isFavorite,
  isPhysicalCopy,
  locale,
}: EntryFlags & {
  entryId: string;
  gameName: string;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const [isPending, startTransition] = useTransition();
  const [flags, setFlags] = useOptimistic<EntryFlags, Partial<EntryFlags>>(
    { isFavorite, isPhysicalCopy },
    (current, patch) => ({ ...current, ...patch }),
  );

  function toggle(field: keyof EntryFlags) {
    const formData = new FormData();
    formData.set("entryId", entryId);
    const nextValue = !flags[field];

    startTransition(async () => {
      setFlags({ [field]: nextValue });
      if (field === "isFavorite") {
        await toggleFavoriteAction(formData);
      } else {
        await togglePhysicalCopyAction(formData);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("profile.currentPlaying.moreActions", { name: gameName })}
          className="flex-none"
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/profile?tab=journal&journalMode=write&entryId=${entryId}`}>
            <BookOpen />
            {t("profile.currentPlaying.diaryPage")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={flags.isFavorite}
          disabled={isPending}
          onCheckedChange={() => toggle("isFavorite")}
          onSelect={(event) => event.preventDefault()}
        >
          <Heart className={flags.isFavorite ? "fill-current text-clay" : undefined} />
          {t("favorite.current")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={flags.isPhysicalCopy}
          disabled={isPending}
          onCheckedChange={() => toggle("isPhysicalCopy")}
          onSelect={(event) => event.preventDefault()}
        >
          <Disc3 />
          {t("physicalMedia.label")}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

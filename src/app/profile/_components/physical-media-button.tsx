import { Disc3 } from "lucide-react";
import { createTranslator, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { togglePhysicalCopyAction } from "../actions";

export function PhysicalMediaButton({
  entryId,
  gameName,
  isPhysicalCopy,
  locale,
  fullWidth = false,
}: {
  entryId: string;
  gameName: string;
  isPhysicalCopy: boolean;
  locale: Locale;
  fullWidth?: boolean;
}) {
  const t = createTranslator(locale);
  const title = isPhysicalCopy
    ? t("physicalMedia.removeTitle", { name: gameName })
    : t("physicalMedia.addTitle", { name: gameName });

  return (
    <form action={togglePhysicalCopyAction}>
      <input type="hidden" name="entryId" value={entryId} />
      <button
        aria-label={title}
        className={cn(
          "cursor-pointer rounded-pill border border-edge bg-surface text-xs font-bold text-ink-soft shadow-rest transition-colors hover:bg-sage-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
          fullWidth
            ? "inline-flex w-full items-center justify-center gap-2 px-3 py-2"
            : "grid h-9 w-9 place-items-center",
        )}
        title={title}
        type="submit"
      >
        <Disc3
          aria-hidden
          className={cn(
            fullWidth ? "h-4 w-4" : "h-4.5 w-4.5",
            isPhysicalCopy ? "text-fern" : "text-edge",
          )}
        />
        {fullWidth
          ? isPhysicalCopy
            ? t("physicalMedia.current")
            : t("physicalMedia.add")
          : null}
      </button>
    </form>
  );
}

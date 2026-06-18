import { Heart } from "lucide-react";
import { createTranslator, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { toggleFavoriteAction } from "../actions";

export function FavoriteButton({
  entryId,
  gameName,
  isFavorite,
  locale,
  fullWidth = false,
}: {
  entryId: string;
  gameName: string;
  isFavorite: boolean;
  locale: Locale;
  fullWidth?: boolean;
}) {
  const t = createTranslator(locale);

  return (
    <form action={toggleFavoriteAction}>
      <input type="hidden" name="entryId" value={entryId} />
      <button
        type="submit"
        className={cn(
          "cursor-pointer rounded-pill border border-edge bg-surface text-xs font-bold text-ink-soft shadow-rest transition-colors hover:bg-clay-soft hover:text-clay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
          fullWidth
            ? "inline-flex w-full items-center justify-center gap-2 px-3 py-2"
            : "grid h-9 w-9 place-items-center",
        )}
        aria-label={
          isFavorite
            ? t("favorite.removeTitle", { name: gameName })
            : t("favorite.addTitle", { name: gameName })
        }
        title={
          isFavorite
            ? t("favorite.removeTitle", { name: gameName })
            : t("favorite.addTitle", { name: gameName })
        }
      >
        <Heart
          aria-hidden
          className={cn(
            fullWidth ? "h-4 w-4" : "h-4.5 w-4.5",
            isFavorite ? "fill-current text-clay" : "text-edge",
          )}
        />
        {fullWidth ? (isFavorite ? t("favorite.current") : t("favorite.add")) : null}
      </button>
    </form>
  );
}

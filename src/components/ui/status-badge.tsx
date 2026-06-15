import { cn } from "@/lib/utils";
import { getStatusDisplayLabel } from "@/lib/copy";

const statusStyles: Record<string, string> = {
  OWNED: "bg-sage-soft text-ink",
  WISHLIST: "bg-sand-soft text-ink",
  PLAYING: "bg-sky-soft text-ink",
  PAUSED: "bg-canvas text-ink-soft",
  COMPLETED: "bg-dusk-lavender-soft text-ink",
  FINISHED: "bg-dusk-lavender-soft text-ink",
  BACKLOG: "bg-canvas text-ink-soft",
  DROPPED: "bg-clay-soft text-ink",
};

/** Soft tinted badge for a UserGameEntry status. */
export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-caption font-bold lowercase",
        "border border-edge",
        statusStyles[status] ?? "bg-canvas text-ink-soft",
        className,
      )}
    >
      {getStatusDisplayLabel(status)}
    </span>
  );
}

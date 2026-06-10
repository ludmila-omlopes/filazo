import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  OWNED: "bg-sage-soft text-ink",
  WISHLIST: "bg-sand-soft text-ink",
  PLAYING: "bg-blue-soft text-ink",
  COMPLETED: "bg-lavender-soft text-ink",
  FINISHED: "bg-lavender-soft text-ink",
  BACKLOG: "bg-bg text-ink-soft",
};

const statusLabels: Record<string, string> = {
  OWNED: "owned",
  WISHLIST: "wishlist",
  PLAYING: "playing",
  COMPLETED: "completed",
  FINISHED: "finished",
  BACKLOG: "resting",
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
        "inline-block rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold lowercase tracking-wide",
        statusStyles[status] ?? "bg-bg text-ink-soft",
        className,
      )}
    >
      {statusLabels[status] ?? status.toLowerCase()}
    </span>
  );
}

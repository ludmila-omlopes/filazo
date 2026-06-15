import { cn } from "@/lib/utils";

/** Quiet stat tile: a display number over a small muted label. */
export function StatCard({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "tactile-surface rounded-inner border border-edge bg-surface p-4 text-center shadow-rest",
        className,
      )}
    >
      <strong className="stat-value block font-medium leading-none">
        {value}
      </strong>
      <span className="stat-label mt-2">
        {label}
      </span>
    </div>
  );
}

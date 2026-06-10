import { cn } from "@/lib/utils";

/** Quiet stat tile: a serif number over a small muted label. */
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
        "rounded-inner border border-edge bg-paper p-4 text-center",
        className,
      )}
    >
      <strong className="block font-display text-[clamp(1.5rem,3vw,2rem)] font-medium leading-none">
        {value}
      </strong>
      <span className="mt-2 block text-[0.72rem] font-bold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </span>
    </div>
  );
}

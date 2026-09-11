import { cn } from "@/lib/utils";

export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-soft-pulse rounded-inner bg-surface/80 shadow-rest",
        className,
      )}
    />
  );
}

export function GameCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="rounded-card border border-edge bg-surface p-3 shadow-rest">
        <div className="flex gap-3">
          <Skeleton className="h-16 w-12 flex-none" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-edge bg-surface p-3.5 shadow-rest">
      <Skeleton className="aspect-[3/4] w-full" />
      <div className="mt-3 grid gap-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-6 w-20 rounded-pill" />
      </div>
    </div>
  );
}

export function LibraryGridSkeleton() {
  return (
    <div className="library-grid">
      {Array.from({ length: 10 }).map((_, index) => (
        <GameCardSkeleton key={index} />
      ))}
    </div>
  );
}

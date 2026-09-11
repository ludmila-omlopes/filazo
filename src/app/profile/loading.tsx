import { LibraryGridSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main
      id="main-content"
      className="mx-auto grid w-full max-w-page grid-cols-[260px_minmax(0,1fr)] gap-8 max-lg:grid-cols-1"
    >
      <aside className="grid gap-4">
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-48 rounded-card" />
      </aside>
      <div className="grid gap-7">
        <Skeleton className="h-40 rounded-card" />
        <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton className="h-28 rounded-card" key={index} />
          ))}
        </div>
        <LibraryGridSkeleton />
      </div>
    </main>
  );
}

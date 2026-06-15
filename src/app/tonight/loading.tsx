import { GameCardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main id="main-content" className="mx-auto w-full max-w-[1100px] pb-12">
      <section className="rounded-card border border-edge bg-dusk-deep p-8 shadow-float">
        <div className="mx-auto grid max-w-[640px] gap-8">
          <Skeleton className="mx-auto h-12 w-4/5 bg-cream/15" />
          <div className="flex justify-center gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton
                className="h-9 w-28 rounded-pill bg-cream/15"
                key={index}
              />
            ))}
          </div>
          <div className="mx-auto w-full max-w-[420px]">
            <GameCardSkeleton />
          </div>
        </div>
      </section>
    </main>
  );
}

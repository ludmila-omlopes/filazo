import { GameCardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main
      id="main-content"
      className="mx-auto grid w-full max-w-[1100px] gap-8 pb-20"
    >
      <section className="rounded-card border border-edge bg-surface p-8 shadow-soft">
        <div className="grid grid-cols-[1fr_280px] gap-8 max-lg:grid-cols-1">
          <div className="grid content-center gap-4">
            <div className="animate-soft-pulse h-5 w-44 rounded-pill bg-surface shadow-rest" />
            <div className="animate-soft-pulse h-24 w-full max-w-[520px] rounded-inner bg-surface shadow-rest" />
            <div className="animate-soft-pulse h-5 w-full max-w-[420px] rounded-pill bg-surface shadow-rest" />
          </div>
          <GameCardSkeleton />
        </div>
      </section>
    </main>
  );
}

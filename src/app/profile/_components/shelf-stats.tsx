import { StatCard } from "@/components/ui/stat-card";
import { formatNumber } from "@/lib/utils";
import type { ProfileData } from "./profile-types";

export function ShelfStats({ profile }: { profile: ProfileData }) {
  const entries = profile.user.gameEntries;
  const playingNow = entries.filter((entry) => entry.status === "PLAYING").length;
  const finished = entries.filter(
    (entry) => entry.status === "COMPLETED" || entry.finishedAt,
  ).length;
  const hours = Math.round(
    entries.reduce((total, entry) => total + (entry.playtimeMinutes ?? 0), 0) /
      60,
  );

  return (
    <section className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
      <StatCard
        value={formatNumber(entries.length)}
        label="catalog entries"
      />
      <StatCard value={formatNumber(playingNow)} label="playing now" />
      <StatCard value={formatNumber(finished)} label="credits rolled" />
      <StatCard value={formatNumber(hours)} label="hours of joy so far" />
    </section>
  );
}

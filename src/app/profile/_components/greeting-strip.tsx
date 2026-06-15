import { Chip } from "@/components/ui/chip";
import { formatNumber } from "@/lib/utils";
import type { ProfileData } from "./profile-types";

function getGreetingLine() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning. The catalog is ready when you are.";
  }

  if (hour < 18) {
    return "Good afternoon. Every entry can wait.";
  }

  return "Good evening. Pick one, or just browse.";
}

function ProviderChip({
  label,
  connected,
}: {
  label: string;
  connected: boolean;
}) {
  return (
    <Chip tone={connected ? "sage" : "neutral"}>
      {label}: {connected ? "connected" : "resting"}
    </Chip>
  );
}

export function GreetingStrip({ profile }: { profile: ProfileData }) {
  return (
    <section className="panel bg-sky-soft/70">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="section-label">Your catalog</p>
          <h2 className="text-page-title leading-tight">
            {profile.user.displayName ?? "Player"}
          </h2>
          <p className="mt-2 max-w-[52ch] leading-relaxed text-ink-soft">
            {getGreetingLine()} {formatNumber(profile.user.gameEntries.length)}{" "}
            games have a readable place here.
          </p>
        </div>
        <div className="flex max-w-[420px] flex-wrap justify-end gap-2 max-md:justify-start">
          <ProviderChip label="Steam" connected={Boolean(profile.steamAccount)} />
          <ProviderChip
            label="PlayStation"
            connected={Boolean(profile.playStationAccount)}
          />
          <ProviderChip label="Xbox" connected={Boolean(profile.xboxAccount)} />
        </div>
      </div>
    </section>
  );
}

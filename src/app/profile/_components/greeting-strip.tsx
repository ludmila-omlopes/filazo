import Link from "next/link";
import { Button } from "@/components/ui/button";
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

export function GreetingStrip({ profile }: { profile: ProfileData }) {
  const connectedCount = profile.user.externalAccounts.length;

  return (
    <section className="panel bg-sky-soft/70">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="section-label">Library home</p>
          <h2 className="text-page-title leading-tight">
            {profile.user.displayName ?? "Player"}
          </h2>
          <p className="mt-2 max-w-[52ch] leading-relaxed text-ink-soft">
            {getGreetingLine()} {formatNumber(profile.user.gameEntries.length)}{" "}
            games have a readable place here.
          </p>
          <p className="mt-2 text-sm font-semibold text-ink-soft">
            {connectedCount
              ? `${formatNumber(connectedCount)} source${connectedCount === 1 ? "" : "s"} connected.`
              : "No sources connected yet."}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-3 max-md:justify-start">
          <Button asChild>
            <Link href="/tonight">Pick for tonight</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/profile?tab=games">Browse shelf</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/profile?tab=integrations">Add games</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

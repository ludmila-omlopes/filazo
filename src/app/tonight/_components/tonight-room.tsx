"use client";

import Link from "next/link";
import { Check, Moon } from "lucide-react";
import { GameCard } from "@/components/game-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  chooseTonightGameAction,
  dimTheLightsAction,
} from "../actions";

export type TonightPick = {
  entryId: string;
  reason: string;
  source: "openai" | "rules";
  entry: {
    completionPercent: number | null;
    finishedAt: Date | null;
    platformName: string | null;
    playtimeMinutes: number | null;
    status: string;
    game: {
      coverUrl?: string | null;
      genres?: unknown;
      name: string;
      slug: string;
    };
  };
};

export type TonightMood = {
  href: string;
  label: string;
  value: string;
};

export function TonightRoom({
  alternatives,
  currentMood,
  isNight,
  message,
  moods,
  offset,
  pick,
  playingPick,
}: {
  alternatives: TonightPick[];
  currentMood: string;
  isNight: boolean;
  message?: string;
  moods: TonightMood[];
  offset: number;
  pick: TonightPick | null;
  playingPick: TonightPick | null;
}) {
  if (!pick) {
    return (
      <div className="relative grid min-h-[62vh] place-items-center overflow-hidden rounded-card border border-edge bg-dusk-deep p-8 text-cream shadow-float">
        <NightCatalogLines />
        <EmptyState title="No evening pick yet.">
          Add a few games to your catalog, then come back when the room is dim.
          <div className="mt-5">
            <Button asChild>
              <Link href="/profile">Add games to the catalog</Link>
            </Button>
          </div>
        </EmptyState>
      </div>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-card border border-edge bg-dusk-deep p-8 text-cream shadow-float max-md:p-5">
      <NightCatalogLines />
      <div className="relative z-10 mx-auto grid max-w-[960px] gap-10">
        {!isNight ? (
          <form
            action={dimTheLightsAction}
            className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-cream/10 bg-cream/8 px-4 py-3 text-sm text-cream/75"
          >
            <span>Dim the lights?</span>
            <Button
              className="border-cream/20 bg-cream/10 text-cream hover:bg-cream/15"
              size="sm"
              type="submit"
              variant="ghost"
            >
              <Moon aria-hidden />
              Night Mode
            </Button>
          </form>
        ) : null}

        {message ? (
          <p className="rounded-card border border-glow/20 bg-glow/10 px-4 py-3 text-sm font-semibold text-cream/85">
            {message}
          </p>
        ) : null}

        {playingPick ? (
          <div className="rounded-card border border-glow/20 bg-glow/10 p-5">
            <p className="section-label !mb-1 text-glow">Back to an old save?</p>
            <p className="text-sm leading-relaxed text-cream/75">
              {playingPick.entry.game.name} is already open in the catalog.
              Continuity beats novelty at night.
            </p>
          </div>
        ) : null}

        <div className="grid gap-5 text-center">
          <p className="text-kicker font-bold uppercase text-glow/85">
            Tonight
          </p>
          <h1 className="font-display text-display font-normal leading-none">
            What kind of night is it?
          </h1>
          <div className="flex flex-wrap justify-center gap-2">
            {moods.map((mood) => (
              <Link
                className={cn(
                  "rounded-pill border px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow focus-visible:ring-offset-2 focus-visible:ring-offset-dusk-deep",
                  currentMood === mood.value
                    ? "border-glow bg-glow text-dusk-deep"
                    : "border-cream/15 bg-cream/8 text-cream/75 hover:bg-cream/12 hover:text-cream",
                )}
                href={mood.href}
                key={mood.value}
              >
                {mood.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-[460px] gap-4">
          <GameCard
            className="bg-cream text-dusk-deep shadow-float"
            completionPercent={pick.entry.completionPercent}
            description={pick.reason}
            eyebrow="Suggested for tonight"
            game={pick.entry.game}
            platformName={pick.entry.platformName}
            playtimeMinutes={pick.entry.playtimeMinutes}
            status={
              pick.entry.finishedAt && pick.entry.status !== "COMPLETED"
                ? "FINISHED"
                : pick.entry.status
            }
            variant="slot"
          />

          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <form action={chooseTonightGameAction}>
              <input type="hidden" name="entryId" value={pick.entryId} />
              <Button className="w-full" type="submit">
                <Check aria-hidden />
                Choose this
              </Button>
            </form>
            <Button
              asChild
              className="border-cream/20 bg-cream/10 text-cream hover:bg-cream/15"
              variant="ghost"
            >
              <Link href={`/tonight?mood=${currentMood}&skip=${offset + 1}`}>
                Not tonight
              </Link>
            </Button>
          </div>
        </div>

        {alternatives.length ? (
          <div className="grid gap-3">
            <p className="text-center text-xs font-bold uppercase text-cream/45">
              also nearby
            </p>
            <div className="grid grid-cols-2 gap-3 opacity-75 max-sm:grid-cols-1">
              {alternatives.map((alternative) => (
                <GameCard
                  className="bg-cream/95 text-dusk-deep"
                  description={alternative.reason}
                  game={alternative.entry.game}
                  key={alternative.entryId}
                  platformName={alternative.entry.platformName}
                  playtimeMinutes={alternative.entry.playtimeMinutes}
                  status={alternative.entry.status}
                  variant="row"
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function NightCatalogLines() {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-glow" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(159,153,209,0.18),rgba(134,186,218,0.1)_44%,rgba(219,170,215,0.13)_72%,rgba(255,227,179,0.1))]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-6 top-8 h-[calc(100%-4rem)] w-10 rounded-inner border border-cream/10 bg-cream/8 max-md:hidden"
      />
    </>
  );
}

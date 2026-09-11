import Link from "next/link";
import type { GameCardGame } from "@/components/game-card";
import { SafeImage } from "@/components/safe-image";
import { StatusLabel } from "@/components/ui/status-badge";
import { translate, type Locale } from "@/lib/i18n";
import { formatTimeEstimate } from "@/lib/utils";

export function GuideGameCard({
  game,
  description,
  eyebrow,
  platformName,
  playtimeMinutes,
  isPhysicalCopy,
  status,
  locale,
}: {
  game: GameCardGame;
  description?: string | null;
  eyebrow?: string;
  platformName?: string | null;
  playtimeMinutes?: number | null;
  isPhysicalCopy?: boolean;
  status?: string | null;
  locale: Locale;
}) {
  const fallback = (
    <span className="grid h-full place-items-center bg-sage-soft text-2xl text-ink-soft" aria-hidden>
      {game.name.slice(0, 1)}
    </span>
  );
  const metadata = [
    platformName,
    isPhysicalCopy ? translate(locale, "physicalMedia.label") : null,
    playtimeMinutes ? translate(locale, "common.playtimeSoFar", { value: formatTimeEstimate(playtimeMinutes, locale) }) : null,
  ].filter(Boolean);

  return (
    <Link
      href={`/games/${game.slug}`}
      className="guide-game-card grid min-w-0 grid-cols-[72px_minmax(0,1fr)] content-start gap-x-4 gap-y-3 rounded-inner border border-edge bg-canvas/50 p-4 transition-colors hover:border-sage hover:bg-sage-soft/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage sm:grid-cols-[96px_minmax(0,1fr)]"
    >
      <div className="relative aspect-[3/4] self-start overflow-hidden rounded-inner bg-sage-soft sm:row-span-2">
        {game.coverUrl ? (
          <SafeImage alt="" src={game.coverUrl} fill sizes="(max-width: 639px) 72px, 96px" className="object-cover" fallback={fallback} />
        ) : fallback}
      </div>
      <div className="grid min-w-0 content-start gap-2">
        {eyebrow ? <p className="text-xs font-semibold text-ink-soft">{eyebrow}</p> : null}
        <h3 className="break-words text-lg leading-snug">{game.name}</h3>
        {metadata.length ? <p className="text-xs leading-relaxed text-ink-soft">{metadata.join(" · ")}</p> : null}
        {status && status !== "OWNED" ? <StatusLabel locale={locale} status={status} /> : null}
      </div>
      {description ? (
        <p className="col-span-2 max-w-[65ch] text-sm leading-relaxed text-ink-soft sm:col-span-1 sm:col-start-2">{description}</p>
      ) : null}
    </Link>
  );
}

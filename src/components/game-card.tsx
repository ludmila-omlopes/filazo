import Image from "next/image";
import Link from "next/link";
import type { MouseEventHandler } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Chip } from "@/components/ui/chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn, formatPlaytime } from "@/lib/utils";

const gameCardVariants = cva(
  "group/card block rounded-card border border-edge bg-surface text-ink shadow-rest outline-none transition-[box-shadow,border-color] duration-[250ms] ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-safe:transition-[transform,box-shadow,border-color] motion-safe:hover:-translate-y-0.5 hover:shadow-lift",
  {
    variants: {
      variant: {
        shelf: "p-3.5",
        row: "p-2.5",
        slot:
          "p-4 hover:border-glow night:hover:border-glow night:hover:shadow-[0_16px_36px_color-mix(in_srgb,var(--color-glow)_16%,transparent)]",
      },
    },
    defaultVariants: {
      variant: "shelf",
    },
  },
);

type GameCardVariant = NonNullable<
  VariantProps<typeof gameCardVariants>["variant"]
>;

export type GameCardGame = {
  name: string;
  slug: string;
  coverUrl?: string | null;
};

type GameCardProps = VariantProps<typeof gameCardVariants> & {
  game: GameCardGame;
  platformName?: string | null;
  playtimeMinutes?: number | null;
  completionPercent?: number | null;
  status?: string | null;
  finished?: boolean;
  eyebrow?: string;
  description?: string | null;
  chips?: string[];
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
  id?: string;
};

function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

function getDisplayStatus(
  status: string | null | undefined,
  finished: boolean | undefined,
) {
  if (finished && status !== "COMPLETED") {
    return "FINISHED";
  }

  return status;
}

function getPlaytimeLabel(
  playtimeMinutes: number | null | undefined,
  completionPercent: number | null | undefined,
) {
  if (!playtimeMinutes || playtimeMinutes <= 0) {
    return null;
  }

  return formatPlaytime(playtimeMinutes, completionPercent).replace(
    " played",
    " so far",
  );
}

function Cover({
  game,
  variant,
}: {
  game: GameCardGame;
  variant: GameCardVariant;
}) {
  const isRow = variant === "row";

  return (
    <div
      className={cn(
        "printed-cover relative flex-none overflow-hidden rounded-inner bg-sage-soft",
        isRow ? "h-16 w-12" : "aspect-[3/4] w-full",
      )}
    >
      {game.coverUrl ? (
        <Image
          alt=""
          className="object-cover"
          fill
          sizes={
            isRow
              ? "48px"
              : "(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 220px"
          }
          src={game.coverUrl}
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-sage-soft p-3 text-center font-display text-3xl font-medium text-ink-soft">
          {getInitial(game.name)}
        </div>
      )}
    </div>
  );
}

function Metadata({
  platformName,
  playtimeLabel,
}: {
  platformName?: string | null;
  playtimeLabel: string | null;
}) {
  const parts = [platformName, playtimeLabel].filter(Boolean);

  if (!parts.length) {
    return null;
  }

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold text-ink-soft">
      {parts.map((part, index) => (
        <span className="inline-flex items-center gap-1.5" key={part}>
          {index > 0 ? <span aria-hidden>&middot;</span> : null}
          {index === 0 && platformName ? (
            <Chip className="px-2 py-px text-[0.62rem]" tone="neutral">
              {part}
            </Chip>
          ) : (
            part
          )}
        </span>
      ))}
    </p>
  );
}

export function GameCard({
  game,
  platformName,
  playtimeMinutes,
  completionPercent,
  status,
  finished,
  eyebrow,
  description,
  chips = [],
  href,
  onClick,
  disabled,
  variant = "shelf",
  className,
  id,
}: GameCardProps) {
  const resolvedVariant = variant ?? "shelf";
  const playtimeLabel = getPlaytimeLabel(playtimeMinutes, completionPercent);
  const displayStatus = getDisplayStatus(status, finished);
  const targetHref = href ?? `/games/${game.slug}`;
  const showDetails = resolvedVariant !== "shelf";
  const content =
    resolvedVariant === "row" ? (
      <>
        <Cover game={game} variant={resolvedVariant} />
        <div className="min-w-0 flex-1 text-left">
          {eyebrow ? <p className="section-label !mb-1">{eyebrow}</p> : null}
          <h3 className="line-clamp-2 font-display text-base leading-tight">
            {game.name}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Metadata platformName={platformName} playtimeLabel={playtimeLabel} />
            {displayStatus ? <StatusBadge status={displayStatus} /> : null}
          </div>
          {description ? (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-soft">
              {description}
            </p>
          ) : null}
        </div>
      </>
    ) : (
      <>
        <Cover game={game} variant={resolvedVariant} />
        <div className="mt-3 grid gap-2 text-left">
          {eyebrow ? <p className="section-label !mb-0">{eyebrow}</p> : null}
          <h3
            className={cn(
              "line-clamp-2 font-display font-medium leading-tight",
              resolvedVariant === "slot" ? "text-xl" : "text-base",
            )}
          >
            {game.name}
          </h3>
          {showDetails ? (
            <>
              <Metadata platformName={platformName} playtimeLabel={playtimeLabel} />
              <div className="flex flex-wrap items-center gap-2">
                {displayStatus ? <StatusBadge status={displayStatus} /> : null}
                {chips.slice(0, 2).map((chip) => (
                  <Chip key={chip} tone="blue">
                    {chip}
                  </Chip>
                ))}
              </div>
            </>
          ) : null}
          {description ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-ink-soft">
              {description}
            </p>
          ) : null}
        </div>
      </>
    );

  if (onClick) {
    return (
      <button
        className={cn(
          gameCardVariants({ variant: resolvedVariant }),
          resolvedVariant === "row" && "flex items-center gap-3 text-left",
          "w-full disabled:pointer-events-none disabled:opacity-55",
          className,
        )}
        disabled={disabled}
        id={id}
        onClick={onClick}
        type="button"
      >
        {content}
      </button>
    );
  }

  if (resolvedVariant === "row") {
    return (
      <Link
        className={cn(
          gameCardVariants({ variant: resolvedVariant }),
          "flex items-center gap-3",
          className,
        )}
        href={targetHref}
        id={id}
      >
        {content}
      </Link>
    );
  }

  return (
    <Link
      className={cn(gameCardVariants({ variant: resolvedVariant }), className)}
      href={targetHref}
      id={id}
    >
      {content}
    </Link>
  );
}

import Link from "next/link";
import { Heart } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { SafeImage } from "@/components/safe-image";
import { Chip } from "@/components/ui/chip";
import { StatusBadge, StatusLabel } from "@/components/ui/status-badge";
import { translate, type Locale } from "@/lib/i18n";
import { formatPlatformNames } from "@/lib/platform-names";
import { cn, formatTimeEstimate } from "@/lib/utils";

// Slot cards sit in an `@container/slots` grid. When that grid only fits one
// column (narrow phones, the pane beside a sidebar) a full-width cover would
// stretch a small image into a very tall card, so the card becomes a compact
// row: thumbnail on the left, title and details on the right.
const compactSlotCard =
  "@max-[31rem]/slots:grid @max-[31rem]/slots:grid-cols-[3.5rem_minmax(0,1fr)] @max-[31rem]/slots:items-center @max-[31rem]/slots:gap-3 @max-[31rem]/slots:p-3";

const gameCardVariants = cva(
  "group/card block rounded-card border border-edge bg-surface text-ink shadow-rest outline-none transition-[box-shadow,border-color] duration-[250ms] ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-safe:transition-[transform,box-shadow,border-color] motion-safe:hover:-translate-y-0.5 hover:shadow-lift",
  {
    variants: {
      variant: {
        shelf: "p-3.5",
        row: "p-2.5",
        focus: "grid grid-cols-[80px_minmax(0,1fr)] items-start gap-4 p-4",
        // One highlighted pick: medium cover beside the text, so the whole
        // suggestion fits on a phone screen without scrolling.
        feature:
          "grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-4 p-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-5 sm:p-5",
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
  isPhysicalCopy?: boolean;
  /** Shows a small heart after the title. */
  isFavorite?: boolean;
  playtimeMinutes?: number | null;
  completionPercent?: number | null;
  status?: string | null;
  /** How a non-null status renders: tinted badge (default), plain text label, or hidden. */
  statusVariant?: "badge" | "label" | "none";
  finished?: boolean;
  eyebrow?: string;
  description?: string | null;
  chips?: string[];
  footer?: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
  id?: string;
  locale?: Locale;
};

function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

function FavoriteMark({ locale }: { locale: Locale }) {
  return (
    <>
      <Heart
        aria-hidden
        className="ml-1.5 inline h-3.5 w-3.5 -translate-y-px fill-current align-baseline text-clay"
      />
      <span className="sr-only">{translate(locale, "favorite.current")}</span>
    </>
  );
}

function StatusDisplay({
  status,
  variant,
  locale,
  className,
}: {
  status: string | null | undefined;
  variant: "badge" | "label" | "none";
  locale: Locale;
  className?: string;
}) {
  if (!status || variant === "none") {
    return null;
  }

  return variant === "label" ? (
    <StatusLabel className={className} locale={locale} status={status} />
  ) : (
    <StatusBadge className={className} locale={locale} status={status} />
  );
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
  locale: Locale,
  playtimeMinutes: number | null | undefined,
) {
  if (!playtimeMinutes || playtimeMinutes <= 0) {
    return null;
  }

  return translate(locale, "common.playtimeSoFar", {
    value: formatTimeEstimate(playtimeMinutes, locale),
  });
}

function Cover({
  game,
  variant,
}: {
  game: GameCardGame;
  variant: GameCardVariant;
}) {
  const isRow = variant === "row";
  const fallback = (
    <div className="grid h-full w-full place-items-center bg-sage-soft p-3 text-center font-display text-3xl font-medium text-ink-soft">
      {getInitial(game.name)}
    </div>
  );

  return (
    <div
      className={cn(
        "printed-cover relative flex-none overflow-hidden rounded-inner bg-sage-soft",
        isRow ? "h-16 w-12" : "aspect-[3/4] w-full",
        variant === "slot" && "@max-[31rem]/slots:w-14",
      )}
    >
      {game.coverUrl ? (
        <SafeImage
          alt=""
          className="object-cover"
          fallback={fallback}
          fill
          sizes={
            isRow
              ? "48px"
              : variant === "focus"
                ? "80px"
              : variant === "feature"
                ? "(max-width: 639px) 104px, 144px"
              : variant === "slot"
                ? "(max-width: 639px) calc(100vw - 100px), (max-width: 1023px) 45vw, 320px"
                : "(max-width: 639px) 45vw, (max-width: 1023px) 30vw, 220px"
          }
          src={game.coverUrl}
        />
      ) : (
        fallback
      )}
    </div>
  );
}

function Metadata({
  isPhysicalCopy,
  locale,
  platformName,
  playtimeLabel,
}: {
  isPhysicalCopy?: boolean;
  locale: Locale;
  platformName?: string | null;
  playtimeLabel: string | null;
}) {
  const physicalMediaLabel = isPhysicalCopy
    ? translate(locale, "physicalMedia.label")
    : null;
  // Per-user platform names arrive in whatever shape each source used
  // ("playstation ps4", "PC (Microsoft Windows)"); show the short, shared form.
  const platformLabel = formatPlatformNames(platformName) || null;
  const parts = [platformLabel, physicalMediaLabel, playtimeLabel].filter(Boolean);

  if (!parts.length) {
    return null;
  }

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold text-ink-soft">
      {parts.map((part, index) => (
        <span className="inline-flex items-center gap-1.5" key={part}>
          {index > 0 ? <span aria-hidden>&middot;</span> : null}
          {part === platformLabel ? (
            <Chip className="px-2 py-px text-[0.62rem] normal-case" tone="neutral">
              {part}
            </Chip>
          ) : part === physicalMediaLabel ? (
            <Chip className="px-2 py-px text-[0.62rem]" tone="sage">
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
  isPhysicalCopy,
  isFavorite = false,
  playtimeMinutes,
  status,
  statusVariant = "badge",
  finished,
  eyebrow,
  description,
  chips = [],
  footer,
  href,
  onClick,
  disabled,
  variant = "shelf",
  className,
  id,
  locale = "en",
}: GameCardProps) {
  const resolvedVariant = variant ?? "shelf";
  const playtimeLabel = getPlaytimeLabel(locale, playtimeMinutes);
  const displayStatus = getDisplayStatus(status, finished);
  const targetHref = href ?? `/games/${game.slug}`;
  const showDetails = resolvedVariant !== "shelf";
  // Cover and text sit side by side instead of stacked.
  const isSideBySide = resolvedVariant === "focus" || resolvedVariant === "feature";
  const content =
    resolvedVariant === "row" ? (
      <>
        <Cover game={game} variant={resolvedVariant} />
        <div className="min-w-0 flex-1 text-left">
          {eyebrow ? <p className="section-label !mb-1">{eyebrow}</p> : null}
          <h3 className="line-clamp-2 font-display text-base leading-tight">
            {game.name}
            {isFavorite ? <FavoriteMark locale={locale} /> : null}
          </h3>
          {platformName || isPhysicalCopy || playtimeLabel ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Metadata
                isPhysicalCopy={isPhysicalCopy}
                locale={locale}
                platformName={platformName}
                playtimeLabel={playtimeLabel}
              />
            </div>
          ) : null}
          {description ? (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-soft">
              {description}
            </p>
          ) : null}
        </div>
        <StatusDisplay
          className="ml-auto flex-none whitespace-nowrap pl-2"
          locale={locale}
          status={displayStatus}
          variant={statusVariant}
        />
      </>
    ) : (
      <>
        <Cover game={game} variant={resolvedVariant} />
        <div
          className={cn(
            "grid min-w-0 gap-2 text-left",
            !isSideBySide && "mt-3",
            resolvedVariant === "slot" && "@max-[31rem]/slots:mt-0 @max-[31rem]/slots:gap-1",
          )}
        >
          {eyebrow ? <p className="section-label !mb-0">{eyebrow}</p> : null}
          <h3
            className={cn(
              "font-display font-medium leading-tight",
              !isSideBySide && "line-clamp-2",
              isSideBySide && "break-words",
              resolvedVariant === "slot"
                ? "text-xl"
                : resolvedVariant === "feature"
                  ? "text-2xl sm:text-3xl"
                  : resolvedVariant === "focus"
                    ? "text-lg"
                    : "text-base",
              // Reserve two lines so cards keep a uniform height whether the title
              // wraps to one line or two.
              resolvedVariant === "shelf" && "min-h-[2.5rem]",
              resolvedVariant === "slot" &&
                "min-h-[3.125rem] @max-[31rem]/slots:min-h-0 @max-[31rem]/slots:text-base",
            )}
          >
            {game.name}
            {isFavorite ? <FavoriteMark locale={locale} /> : null}
          </h3>
          {showDetails ? (
            <>
              {/* Fixed-height metadata line so slot cards stay uniform whether or
                  not platform/playtime is present. */}
              <div
                className={cn(
                  "flex items-center",
                  !isSideBySide && "h-6",
                  resolvedVariant === "slot" && "@max-[31rem]/slots:h-auto",
                )}
              >
                <Metadata
                  isPhysicalCopy={isPhysicalCopy}
                  locale={locale}
                  platformName={platformName}
                  playtimeLabel={playtimeLabel}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 empty:hidden">
                <StatusDisplay
                  locale={locale}
                  status={displayStatus}
                  variant={statusVariant}
                />
                {chips.slice(0, 2).map((chip) => (
                  <Chip key={chip} tone="blue">
                    {chip}
                  </Chip>
                ))}
              </div>
            </>
          ) : statusVariant === "label" ? (
            // Fixed-height status line keeps every shelf card the same height
            // whether or not it shows a label (owned cards show none).
            <div className="flex h-5 items-center">
              {displayStatus ? (
                <StatusLabel locale={locale} status={displayStatus} />
              ) : null}
              {isPhysicalCopy ? (
                <Chip className="px-2 py-px text-[0.62rem]" tone="sage">
                  {translate(locale, "physicalMedia.label")}
                </Chip>
              ) : null}
            </div>
          ) : null}
          {description ? (
            <p
              className={cn(
                "text-sm leading-relaxed text-ink-soft",
                resolvedVariant !== "feature" && "line-clamp-3",
              )}
            >
              {description}
            </p>
          ) : null}
          {footer ? <div className="pt-1">{footer}</div> : null}
        </div>
      </>
    );

  if (onClick) {
    return (
      <button
        className={cn(
          gameCardVariants({ variant: resolvedVariant }),
          resolvedVariant === "row" && "flex items-center gap-3 text-left",
          resolvedVariant === "slot" && compactSlotCard,
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
      className={cn(
        gameCardVariants({ variant: resolvedVariant }),
        resolvedVariant === "slot" && compactSlotCard,
        className,
      )}
      href={targetHref}
      id={id}
    >
      {content}
    </Link>
  );
}

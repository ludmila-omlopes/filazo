import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 w-full max-w-[1100px] border-t border-edge py-8 text-sm text-ink-soft">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="group inline-flex items-baseline gap-2">
          <span className="font-display text-lg font-medium text-ink">
            filazo
          </span>
          <span
            aria-hidden
            className="h-5 w-1.5 translate-y-1 rounded-[2px] bg-glow motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-y-110"
          />
        </Link>

        <p className="font-display text-base italic text-ink">
          Your catalog, your pace.
        </p>

        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-4 text-sm"
        >
          <Link className="nav-link" href="/profile">
            Library
          </Link>
          <a
            className="nav-link"
            href="https://github.com/ludmila-omlopes/filazo"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </nav>

        <p className="text-caption font-semibold uppercase">
          made for players with too many games
        </p>
      </div>
    </footer>
  );
}

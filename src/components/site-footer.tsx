import Link from "next/link";
import { createTranslator, type Locale } from "@/lib/i18n";

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = createTranslator(locale);

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
          {t("footer.tagline")}
        </p>

        <nav
          aria-label={t("nav.footer")}
          className="flex flex-wrap items-center gap-4 text-sm"
        >
          <Link className="nav-link" href="/profile">
            {t("common.library")}
          </Link>
          <Link className="nav-link" href="/privacy">
            {t("auth.dialog.privacy")}
          </Link>
          <Link className="nav-link" href="/terms">
            {t("auth.dialog.terms")}
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
          {t("footer.madeFor")}
        </p>
      </div>
    </footer>
  );
}

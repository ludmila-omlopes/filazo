import Link from "next/link";
import { GameCard } from "@/components/game-card";
import { Button } from "@/components/ui/button";
import { createTranslator } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { parsePublicCatalogParams, publicCatalogHref, readPublicCatalog } from "@/lib/public-catalog";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/site-metadata";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props) {
  const { q, page } = parsePublicCatalogParams(await searchParams);
  const t = createTranslator(await getRequestLocale());
  return {
    ...createPageMetadata({
      title: t("common.catalog"), description: t("publicCatalog.description"),
      path: publicCatalogHref(q, page),
    }),
    // Search variations stay usable without creating an index of arbitrary queries.
    ...(q ? { robots: { index: false, follow: true, googleBot: { index: false, follow: true } } } : {}),
  };
}

export default async function CatalogPage({ searchParams }: Props) {
  const [params, locale] = await Promise.all([searchParams, getRequestLocale()]);
  const { q, page, games, hasNext } = await readPublicCatalog(prisma, params);
  const t = createTranslator(locale);

  return (
    <main id="main-content" className="mx-auto grid w-full max-w-page gap-8 py-8">
      <header className="grid gap-3">
        <h1 className="text-section-title">{t("common.catalog")}</h1>
        <p className="max-w-[60ch] text-ink-soft">{t("publicCatalog.description")}</p>
      </header>
      <form action="/catalog" method="get" role="search" className="grid gap-2">
        <label htmlFor="catalog-search" className="text-sm font-semibold">{t("publicCatalog.searchLabel")}</label>
        <div className="flex flex-wrap items-center gap-3">
          <input key={q} id="catalog-search" type="search" name="q" defaultValue={q} maxLength={100}
            className="min-h-11 w-full min-w-0 rounded-inner border border-edge bg-surface px-4 text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-md" />
          <Button type="submit">{t("publicCatalog.search")}</Button>
          {q ? <Link className="nav-link text-sm" href="/catalog">{t("publicCatalog.clear")}</Link> : null}
        </div>
      </form>
      {games.length ? (
        <div className="library-grid">
          {games.map((game) => <GameCard key={game.slug} game={game} locale={locale} variant="shelf" />)}
        </div>
      ) : (
        <section className="grid gap-3 rounded-card border border-edge bg-surface p-6">
          <h2 className="font-display text-xl">{t("publicCatalog.empty")}</h2>
          <p className="text-ink-soft">{t("publicCatalog.emptyBody")}</p>
          <Link className="nav-link justify-self-start" href="/catalog">{t("publicCatalog.browse")}</Link>
        </section>
      )}
      {page > 1 || hasNext ? (
        <nav aria-label={t("publicCatalog.pagination")} className="flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-6">
          {page > 1 ? <Button asChild variant="ghost"><Link rel="prev" href={publicCatalogHref(q, page - 1)}>{t("publicCatalog.previous")}</Link></Button> : <span />}
          {hasNext ? <Button asChild variant="ghost"><Link rel="next" href={publicCatalogHref(q, page + 1)}>{t("publicCatalog.next")}</Link></Button> : null}
        </nav>
      ) : null}
    </main>
  );
}

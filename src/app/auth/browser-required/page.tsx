import { ExternalLink, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { createTranslator, type Locale } from "@/lib/i18n";
import { getSafeOAuthReturnPath } from "@/lib/oauth-browser";
import { getRequestLocale } from "@/lib/request-locale";

type BrowserRequiredSearchParams = Promise<{
  next?: string;
}>;

function getDisplayUrl(returnPath: string) {
  if (!process.env.APP_URL) {
    return returnPath;
  }

  try {
    return new URL(returnPath, process.env.APP_URL).toString();
  } catch {
    return returnPath;
  }
}

export default async function BrowserRequiredPage({
  searchParams,
}: PageProps<"/auth/browser-required"> & {
  searchParams: BrowserRequiredSearchParams;
}) {
  const locale: Locale = await getRequestLocale();
  const t = createTranslator(locale);
  const query = await searchParams;
  const returnPath = getSafeOAuthReturnPath(query.next, "/login?auth=1");
  const displayUrl = getDisplayUrl(returnPath);

  return (
    <main id="main-content" className="mx-auto grid w-full max-w-[860px] gap-6">
      <section className="relative overflow-hidden rounded-card border border-edge bg-dusk-deep p-8 text-cream shadow-float max-md:p-5">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(135deg,rgba(159,153,209,0.18),rgba(134,186,218,0.10)_45%,rgba(255,227,179,0.14))]"
        />
        <div className="relative z-10 grid max-w-[680px] gap-5">
          <p className="text-kicker font-bold uppercase text-glow/80">
            {t("auth.browserRequired.kicker")}
          </p>
          <h1 className="text-page-title leading-tight">
            {t("auth.browserRequired.title")}
          </h1>
          <p className="max-w-[62ch] leading-relaxed text-cream/76">
            {t("auth.browserRequired.body")}
          </p>

          <Notice
            className="text-ink"
            icon={<ShieldAlert className="h-5 w-5" />}
            tone="warning"
          >
            {t("auth.browserRequired.notice")}
          </Notice>

          <div className="rounded-inner border border-cream/12 bg-cream/8 p-4">
            <p className="text-sm font-bold text-cream/70">
              {t("auth.browserRequired.addressLabel")}
            </p>
            <p className="mt-2 break-all font-semibold text-cream">
              {displayUrl}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              className="bg-cream text-dusk-deep hover:bg-glow"
              size="lg"
            >
              <Link href={returnPath}>{t("auth.browserRequired.back")}</Link>
            </Button>
            <Button
              asChild
              className="border-cream/18 bg-cream/8 text-cream hover:bg-cream/14"
              size="lg"
              variant="outline"
            >
              <a href={displayUrl}>
                <ExternalLink className="h-4 w-4" />
                {t("auth.browserRequired.open")}
              </a>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

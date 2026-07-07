import type { Metadata } from "next";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "@fontsource/instrument-sans/700.css";
import "@fontsource/instrument-sans/400-italic.css";
import "@fontsource/instrument-sans/500-italic.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import Link from "next/link";
import { cookies } from "next/headers";
import "./globals.css";
import { AuthDialog } from "@/components/auth-dialog";
import { BetaBanner } from "@/components/beta-banner";
import { LocaleProvider } from "@/components/locale-provider";
import { LocaleToggle } from "@/components/locale-toggle";
import { SignOutForm } from "@/components/sign-out-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeaderFrame } from "@/components/site-header-frame";
import { ThemeRuntime } from "@/components/theme-runtime";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { createTranslator } from "@/lib/i18n";
import { isAdminEmail } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";
import { FILAZO_THEME_COOKIE, parseFilazoThemeMode } from "@/lib/theme";

export const metadata: Metadata = {
  title: "filazo",
  description:
    "A calm catalog for your game library. Sync Steam, import CSVs, and keep every title easy to find.",
};

/**
 * Runs before first paint: resolves the saved mode (and, for "auto", the
 * visitor's local time of day) onto <html data-theme/data-phase> so there is no
 * flash of the wrong theme. ThemeRuntime then keeps it in sync after hydration.
 */
const themeBootstrapScript = `(function(){try{var m=document.cookie.match(/(?:^|; )filazo-theme=([^;]+)/);var mode=m?decodeURIComponent(m[1]):'day';var r=document.documentElement;if(mode==='auto'){var h=new Date().getHours();var p=h<6?'night':h<11?'morning':h<17?'afternoon':h<19?'dusk':h<21?'evening':'night';r.dataset.theme=(p==='morning'||p==='afternoon')?'day':'night';r.dataset.phase=p;}else{r.dataset.theme=mode==='night'?'night':'day';}}catch(e){}})();`;

async function getNavigationUser(userId: string | null) {
  if (!userId) {
    return null;
  }

  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      include: {
        externalAccounts: true,
        betaApplication: true,
      },
    });
  } catch (error) {
    console.error("Could not load navigation user.", error);
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const cookieStore = await cookies();
  const mode = parseFilazoThemeMode(
    cookieStore.get(FILAZO_THEME_COOKIE)?.value,
  );
  const initialTheme = mode === "night" ? "night" : "day";
  const userId = await getSessionUserId();
  const navigationUser = await getNavigationUser(userId);

  return (
    <html
      lang={locale}
      className="has-beta-banner"
      data-theme={initialTheme}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <ThemeRuntime mode={mode} />
        <LocaleProvider locale={locale}>
          <BetaBanner />
          <Button
            asChild
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
          >
            <a href="#main-content">{t("common.skipToContent")}</a>
          </Button>

          <div className="app-shell min-h-screen px-6 pb-6 max-md:px-4 max-md:pb-4">
            <SiteHeaderFrame>
              <Link href="/" className="group inline-flex items-baseline gap-2">
                <span className="font-display text-[1.45rem] font-medium">
                  filazo
                </span>
                <span
                  aria-hidden
                  className="h-5 w-1.5 translate-y-1 rounded-[2px] bg-glow motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-y-110"
                />
              </Link>

              <nav
                className="flex flex-wrap items-center justify-end gap-6 max-sm:justify-start"
                aria-label={t("nav.main")}
              >
                <Link href="/" className="nav-link text-sm">
                  {t("common.home")}
                </Link>
                <Link href="/profile" className="nav-link text-sm">
                  {t("common.library")}
                </Link>
                <Link href="/tonight" className="nav-link text-sm">
                  {t("common.tonight")}
                </Link>
                {navigationUser && isAdminEmail(navigationUser.email) ? (
                  <Link href="/admin" className="nav-link text-sm">
                    {t("admin.kicker")}
                  </Link>
                ) : (
                  <Link href="/beta" className="nav-link text-sm">
                    Beta
                  </Link>
                )}
                <LocaleToggle locale={locale} />
                <ThemeToggle mode={mode} />
                {navigationUser ? (
                  <div className="inline-flex items-center gap-3">
                    <span className="max-w-[16ch] truncate text-sm font-semibold">
                      {navigationUser.displayName ?? t("common.player")}
                    </span>
                    <SignOutForm label={t("auth.signOut")} />
                  </div>
                ) : (
                  <AuthDialog
                    triggerLabel={t("auth.trigger.signIn")}
                    triggerSize="sm"
                  />
                )}
              </nav>
            </SiteHeaderFrame>
            {children}
            <SiteFooter locale={locale} />
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}

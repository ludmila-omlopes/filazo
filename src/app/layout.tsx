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
import { InlineScript } from "@/components/inline-script";
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
import {
  getSiteUrl,
  SITE_DESCRIPTION,
  SITE_NAME,
} from "@/lib/site-metadata";
import {
  FILAZO_THEME_COOKIE,
  parseFilazoThemeMode,
  themeForPhase,
} from "@/lib/theme";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "game library",
    "video game catalog",
    "gaming backlog",
    "game collection",
    "what to play next",
  ],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

/**
 * Runs before first paint: resolves the saved mode (and, for "auto", the
 * visitor's local time of day) onto <html data-theme/data-phase> so there is no
 * flash of the wrong theme. ThemeRuntime then keeps it in sync after hydration.
 */
const themeBootstrapScript = `(function(){try{var m=document.cookie.match(/(?:^|; )filazo-theme=([^;]+)/);var mode=m?decodeURIComponent(m[1]):'afternoon';var valid={morning:1,afternoon:1,dusk:1,evening:1,night:1};if(mode==='day')mode='afternoon';if(mode!=='auto'&&!valid[mode])mode='afternoon';var r=document.documentElement;var p;if(mode==='auto'){var h=new Date().getHours();p=h<6?'night':h<11?'morning':h<17?'afternoon':h<19?'dusk':h<21?'evening':'night';}else{p=mode;}r.dataset.theme=(p==='morning'||p==='afternoon')?'day':'night';r.dataset.phase=p;}catch(e){}})();`;

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
  // Fixed modes resolve their theme/phase now; "auto" is time-dependent, so the
  // pre-paint script fills those in before first paint.
  const initialTheme = mode === "auto" ? "day" : themeForPhase(mode);
  const initialPhase = mode === "auto" ? undefined : mode;
  const userId = await getSessionUserId();
  const navigationUser = await getNavigationUser(userId);
  const homeHref = userId ? "/profile" : "/";

  return (
    <html
      lang={locale}
      className="has-beta-banner"
      data-theme={initialTheme}
      data-phase={initialPhase}
      suppressHydrationWarning
    >
      <body>
        <InlineScript html={themeBootstrapScript} />
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
              <Link href={homeHref} className="group inline-flex items-baseline gap-2">
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
                <Link href={homeHref} className="nav-link text-sm">
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

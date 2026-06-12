import type { Metadata } from "next";
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/400-italic.css";
import "@fontsource/fraunces/500-italic.css";
import "@fontsource/nunito-sans/400.css";
import "@fontsource/nunito-sans/600.css";
import "@fontsource/nunito-sans/700.css";
import Link from "next/link";
import { cookies } from "next/headers";
import "./globals.css";
import { SignOutForm } from "@/components/sign-out-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeaderFrame } from "@/components/site-header-frame";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { FILAZO_THEME_COOKIE, parseFilazoTheme } from "@/lib/theme";

export const metadata: Metadata = {
  title: "filazo",
  description:
    "A calm home for your game library. Sync Steam, import CSVs, and make peace with your shelf.",
};

async function getNavigationUser(userId: string | null) {
  if (!userId) {
    return null;
  }

  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      include: {
        externalAccounts: true,
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
  const cookieStore = await cookies();
  const theme = parseFilazoTheme(
    cookieStore.get(FILAZO_THEME_COOKIE)?.value,
  );
  const userId = await getSessionUserId();
  const navigationUser = await getNavigationUser(userId);

  return (
    <html lang="en" data-theme={theme}>
      <body>
        {/* Skip to content */}
        <Button
          asChild
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        >
          <a
            href="#main-content"
          >
            Skip to content
          </a>
        </Button>

        <div className="min-h-screen px-6 pb-6 max-md:px-4 max-md:pb-4">
          <SiteHeaderFrame>
            <Link href="/" className="group inline-flex items-baseline gap-2">
              <span className="font-display text-[1.45rem] font-medium tracking-tight">
                filazo
              </span>
              <span
                aria-hidden
                className="h-2 w-2 translate-y-[-1px] rounded-full bg-glow motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-125"
              />
            </Link>

            <nav
              className="flex flex-wrap items-center justify-end gap-6 max-sm:justify-start"
              aria-label="Main"
            >
              <Link href="/" className="nav-link text-sm">
                Home
              </Link>
              <Link href="/profile" className="nav-link text-sm">
                Library
              </Link>
              <Link href="/tonight" className="nav-link text-sm">
                Tonight
              </Link>
              <ThemeToggle theme={theme} />
              {navigationUser ? (
                <div className="inline-flex items-center gap-3">
                  <span className="max-w-[16ch] truncate text-sm font-semibold">
                    {navigationUser.displayName ?? "Player"}
                  </span>
                  <SignOutForm />
                </div>
              ) : (
                <Button asChild size="sm">
                  <a href="/api/auth/steam">Connect Steam</a>
                </Button>
              )}
            </nav>
          </SiteHeaderFrame>
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}

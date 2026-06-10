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
import "./globals.css";
import { SignOutForm } from "@/components/sign-out-form";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export const metadata: Metadata = {
  title: "filazo",
  description:
    "A calm home for your game library. Sync Steam, import CSVs, and make peace with your backlog.",
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
  const userId = await getSessionUserId();
  const navigationUser = await getNavigationUser(userId);

  return (
    <html lang="en">
      <body>
        {/* Skip to content */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 btn btn-primary"
        >
          Skip to content
        </a>

        <div className="min-h-screen px-6 pb-6 max-md:px-4 max-md:pb-4">
          <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between gap-4 py-5 max-sm:flex-col max-sm:gap-3">
            <Link href="/" className="group inline-flex items-baseline gap-2">
              <span className="font-display text-[1.45rem] font-medium tracking-tight">
                filazo
              </span>
              <span
                aria-hidden
                className="h-2 w-2 translate-y-[-1px] rounded-full bg-glow transition-transform duration-300 group-hover:scale-125"
              />
            </Link>

            <nav className="flex flex-wrap items-center gap-6" aria-label="Main">
              <Link href="/" className="nav-link text-sm">
                Home
              </Link>
              <Link href="/profile" className="nav-link text-sm">
                Library
              </Link>
              {navigationUser ? (
                <div className="inline-flex items-center gap-3">
                  <span className="max-w-[16ch] truncate text-sm font-semibold">
                    {navigationUser.displayName ?? "Player"}
                  </span>
                  <SignOutForm />
                </div>
              ) : (
                <a className="btn btn-primary btn-sm" href="/api/auth/steam">
                  Connect Steam
                </a>
              )}
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

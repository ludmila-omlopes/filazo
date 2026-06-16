import Link from "next/link";
import { AuthDialog } from "@/components/auth-dialog";
import { ControllerIllustration } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { getDatabaseErrorMessage } from "@/lib/database-errors";

export function SignedOutPanel() {
  return (
    <main id="main-content" className="mx-auto w-full max-w-[760px]">
      <section className="panel p-10 text-center">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-inner border border-edge bg-canvas text-ink-soft">
          <ControllerIllustration className="h-14 w-14" />
        </div>
        <p className="section-label justify-center">Your catalog</p>
        <h1 className="mb-3 text-page-title leading-snug">
          Connect an account to begin.
        </h1>
        <p className="mx-auto max-w-[42ch] leading-relaxed text-ink-soft">
          Sign in first, then connect Steam, PlayStation, Xbox, or start with a
          CSV-only local profile. Start wherever feels easiest.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <AuthDialog triggerLabel="Sign in" triggerSize="default" />
          <Button asChild variant="ghost">
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

export function ProfileErrorPanel({ error }: { error: unknown }) {
  return (
    <main id="main-content" className="mx-auto w-full max-w-[760px]">
      <section className="panel bg-clay-soft p-10 text-center">
        <p className="section-label justify-center">Database unavailable</p>
        <h1 className="mb-3 text-page-title leading-snug">
          Your library can&apos;t load right now.
        </h1>
        <p className="mx-auto max-w-[44ch] leading-relaxed text-ink-soft">
          {getDatabaseErrorMessage(error)} Vercel deployments need a production
          database connection; this repo&apos;s SQLite file setup is intended for
          local development.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <Button asChild>
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import { AuthDialog } from "@/components/auth-dialog";
import { ControllerIllustration } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { getDatabaseErrorMessage } from "@/lib/database-errors";
import { createTranslator, type Locale } from "@/lib/i18n";

export function SignedOutPanel({ locale }: { locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <main id="main-content" className="mx-auto w-full max-w-[760px]">
      <section className="panel p-10 text-center">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-inner border border-edge bg-canvas text-ink-soft">
          <ControllerIllustration className="h-14 w-14" />
        </div>
        <p className="section-label justify-center">{t("profile.signedOut.label")}</p>
        <h1 className="mb-3 text-page-title leading-snug">
          {t("profile.signedOut.title")}
        </h1>
        <p className="mx-auto max-w-[42ch] leading-relaxed text-ink-soft">
          {t("profile.signedOut.body")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <AuthDialog
            triggerLabel={t("auth.trigger.signIn")}
            triggerSize="default"
          />
          <Button asChild variant="ghost">
            <Link href="/">{t("common.backHome")}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

export function ProfileErrorPanel({
  error,
  locale,
}: {
  error: unknown;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  return (
    <main id="main-content" className="mx-auto w-full max-w-[760px]">
      <section className="panel bg-clay-soft p-10 text-center">
        <p className="section-label justify-center">{t("profile.error.label")}</p>
        <h1 className="mb-3 text-page-title leading-snug">
          {t("profile.error.title")}
        </h1>
        <p className="mx-auto max-w-[44ch] leading-relaxed text-ink-soft">
          {t("profile.error.body", {
            message: getDatabaseErrorMessage(error),
          })}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <Button asChild>
            <Link href="/">{t("common.backHome")}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

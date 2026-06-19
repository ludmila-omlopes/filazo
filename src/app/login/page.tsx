import { redirect } from "next/navigation";
import { AuthDialog } from "@/components/auth-dialog";
import { getDatabaseErrorMessage } from "@/lib/database-errors";
import { createTranslator } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";

type LoginSearchParams = Promise<{
  auth?: string;
  error?: string;
  expired?: string;
}>;

export default async function LoginPage({
  searchParams,
}: PageProps<"/login"> & { searchParams: LoginSearchParams }) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  let sessionError: string | null = null;
  let hasSessionUser = false;

  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      hasSessionUser = Boolean(user);
    } catch (error) {
      console.error("Could not verify login session.", error);
      sessionError = getDatabaseErrorMessage(error);
    }

    if (hasSessionUser) {
      redirect("/profile");
    }

    if (!sessionError) {
      redirect("/api/auth/session/clear?next=/login&reason=expired");
    }
  }

  const query = await searchParams;
  const error =
    query.error ??
    (query.expired ? t("auth.error.sessionExpired") : sessionError) ??
    undefined;

  return (
    <main id="main-content" className="mx-auto grid w-full max-w-[980px] gap-8">
      <AuthDialog defaultOpen error={error} showTrigger={false} />

      <section className="relative min-h-[520px] overflow-hidden rounded-card border border-edge bg-dusk-deep p-8 text-cream shadow-float max-md:p-5">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(135deg,rgba(159,153,209,0.18),rgba(134,186,218,0.10)_45%,rgba(255,227,179,0.14))]"
        />
        <div className="relative z-10 grid max-w-[660px] gap-5">
          <p className="text-kicker font-bold uppercase text-glow/80">
            {t("login.kicker")}
          </p>
          <h1 className="text-page-title leading-tight">
            {t("login.title")}
          </h1>
          <p className="max-w-[58ch] leading-relaxed text-cream/72">
            {t("login.body")}
          </p>
          <div>
            <AuthDialog
              error={error}
              triggerClassName="min-h-12 bg-cream px-7 text-base text-dusk-deep hover:bg-glow"
              triggerLabel={t("login.open")}
              triggerSize="lg"
            />
          </div>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import { BetaTesterStatus, type Prisma } from "@prisma/client";
import { submitBetaApplicationAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { getSessionUserWithBeta, isAdminEmail } from "@/lib/beta-access";
import { createTranslator, type Locale } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";

type BetaSearchParams = Promise<{
  error?: string;
  sent?: string;
}>;

const PLATFORM_OPTIONS = [
  "PC",
  "Steam Deck",
  "PlayStation",
  "Xbox",
  "Nintendo Switch",
  "Mobile",
];

function asStringArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getStatusCopy(
  status: BetaTesterStatus | undefined,
  t: ReturnType<typeof createTranslator>,
) {
  if (status === BetaTesterStatus.PENDING) {
    return {
      title: t("beta.status.pending.title"),
      body: t("beta.status.pending.body"),
      tone: "success" as const,
    };
  }

  if (status === BetaTesterStatus.APPROVED) {
    return {
      title: t("beta.status.approved.title"),
      body: t("beta.status.approved.body"),
      tone: "success" as const,
    };
  }

  if (status === BetaTesterStatus.REJECTED) {
    return {
      title: t("beta.status.rejected.title"),
      body: t("beta.status.rejected.body"),
      tone: "error" as const,
    };
  }

  return null;
}

export default async function BetaPage({
  searchParams,
}: PageProps<"/beta"> & { searchParams: BetaSearchParams }) {
  const locale: Locale = await getRequestLocale();
  const t = createTranslator(locale);
  const query = await searchParams;
  const user = await getSessionUserWithBeta(await getSessionUserId());
  const application = user?.betaApplication ?? null;
  const selectedPlatforms = new Set(asStringArray(application?.platforms));
  const statusCopy = getStatusCopy(application?.status, t);

  if (user && isAdminEmail(user.email)) {
    return (
      <main id="main-content" className="mx-auto grid w-full max-w-[860px] gap-6">
        <Notice tone="success">{t("beta.adminLoggedIn")}</Notice>
        <Button asChild className="w-fit">
          <Link href="/admin">{t("beta.openAdmin")}</Link>
        </Button>
      </main>
    );
  }

  return (
    <main id="main-content" className="mx-auto grid w-full max-w-[980px] gap-8">
      {query.error ? <Notice tone="error">{query.error}</Notice> : null}
      {query.sent ? (
        <Notice tone="success">{t("beta.sent")}</Notice>
      ) : null}

      <section className="relative overflow-hidden rounded-card border border-edge bg-dusk-deep p-8 text-cream shadow-float max-md:p-5">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(135deg,rgba(159,153,209,0.18),rgba(134,186,218,0.10)_45%,rgba(255,227,179,0.14))]"
        />
        <div className="relative z-10 grid max-w-[680px] gap-5">
          <p className="text-kicker font-bold uppercase text-glow/80">
            {t("beta.kicker")}
          </p>
          <h1 className="text-page-title leading-tight">
            {t("beta.title")}
          </h1>
          <p className="max-w-[62ch] leading-relaxed text-cream/76">
            {t("beta.body")}
          </p>
          {!user ? (
            <Button
              asChild
              className="min-h-12 w-fit bg-cream px-7 text-base text-dusk-deep hover:bg-glow"
              size="lg"
            >
              <a href="/api/auth/youtube">
                {t("beta.signInYoutube")}
              </a>
            </Button>
          ) : null}
        </div>
      </section>

      {user ? (
        <Card tactile>
          <CardContent className="grid gap-6 p-6">
            {statusCopy ? (
              <Notice tone={statusCopy.tone}>
                <strong>{statusCopy.title}.</strong> {statusCopy.body}
                {application?.justification ? (
                  <span className="mt-2 block">
                    {t("beta.justification", {
                      value: application.justification,
                    })}
                  </span>
                ) : null}
              </Notice>
            ) : null}

            {!application ? (
              <>
                <Notice tone="success">
                  {t("beta.existingAccount")}
                </Notice>
                <Button asChild className="w-fit">
                  <Link href="/profile">{t("beta.openPlatform")}</Link>
                </Button>
              </>
            ) : application.status === BetaTesterStatus.APPROVED ? (
              <Button asChild className="w-fit">
                <Link href="/profile">{t("beta.openPlatform")}</Link>
              </Button>
            ) : (
              <form action={submitBetaApplicationAction} className="grid gap-5">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-ink">
                    {t("beta.name")}
                  </span>
                  <input
                    className="min-h-12 rounded-inner border border-edge bg-surface px-4 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow"
                    defaultValue={application?.name ?? user.displayName ?? ""}
                    maxLength={80}
                    minLength={2}
                    name="name"
                    required
                  />
                </label>

                <fieldset className="grid gap-3">
                  <legend className="text-sm font-bold text-ink">
                    {t("beta.platforms")}
                  </legend>
                  <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                    {PLATFORM_OPTIONS.map((platform) => (
                      <label
                        className="flex items-center gap-3 rounded-inner border border-edge bg-surface px-4 py-3 text-sm font-semibold text-ink"
                        key={platform}
                      >
                        <input
                          className="h-4 w-4 accent-sage"
                          defaultChecked={selectedPlatforms.has(platform)}
                          name="platform"
                          type="checkbox"
                          value={platform}
                        />
                        {platform}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-ink">
                    {t("beta.retrogames")}
                  </span>
                  <textarea
                    className="min-h-28 rounded-inner border border-edge bg-surface px-4 py-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow"
                    defaultValue={application?.retroGames ?? ""}
                    maxLength={500}
                    name="retroGames"
                    placeholder={t("beta.retrogamesPlaceholder")}
                  />
                </label>

                <Button className="min-h-12 w-fit px-6" type="submit">
                  {t("beta.submit")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

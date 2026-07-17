import { BetaTesterStatus, type Prisma } from "@prisma/client";
import { reviewBetaApplicationAction } from "../actions";
import { AdminNav } from "../admin-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { getSessionUserWithBeta, isAdminEmail } from "@/lib/beta-access";
import { createTranslator, type Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";

type AdminBetaSearchParams = Promise<{
  emailFailed?: string;
  emailSent?: string;
  emailSkipped?: string;
  error?: string;
  reviewed?: string;
}>;

function asStringArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function statusLabel(
  status: BetaTesterStatus,
  t: ReturnType<typeof createTranslator>,
) {
  if (status === BetaTesterStatus.PENDING) {
    return t("admin.status.pending");
  }
  if (status === BetaTesterStatus.APPROVED) {
    return t("admin.status.approved");
  }
  if (status === BetaTesterStatus.REJECTED) {
    return t("admin.status.rejected");
  }
  return t("admin.status.draft");
}

export default async function AdminBetaPage({
  searchParams,
}: PageProps<"/admin/beta"> & { searchParams: AdminBetaSearchParams }) {
  const locale: Locale = await getRequestLocale();
  const t = createTranslator(locale);
  const query = await searchParams;
  const admin = await getSessionUserWithBeta(await getSessionUserId());

  if (!admin || !isAdminEmail(admin.email)) {
    return (
      <main id="main-content" className="mx-auto grid w-full max-w-[860px] gap-6">
        <Notice tone="error">{t("admin.restricted")}</Notice>
        <Button asChild className="w-fit">
          <a href="/api/auth/youtube?next=/admin/beta">
            {t("admin.signInGoogle")}
          </a>
        </Button>
      </main>
    );
  }

  const applications = await prisma.betaTesterApplication.findMany({
    where: {
      status: { not: BetaTesterStatus.DRAFT },
    },
    include: {
      user: true,
      reviewedBy: true,
    },
    orderBy: [
      { status: "desc" },
      { createdAt: "asc" },
    ],
  });

  const pendingCount = applications.filter(
    (application) => application.status === BetaTesterStatus.PENDING,
  ).length;
  const approvedApplications = applications.filter(
    (application) => application.status === BetaTesterStatus.APPROVED,
  );

  return (
    <main id="main-content" className="mx-auto grid w-full max-w-[1100px] gap-8">
      {query.error ? <Notice tone="error">{query.error}</Notice> : null}
      {query.reviewed ? (
        <Notice tone="success">{t("admin.reviewed")}</Notice>
      ) : null}
      {query.emailSent ? (
        <Notice tone="success">{t("admin.email.sent")}</Notice>
      ) : null}
      {query.emailSkipped ? (
        <Notice tone="info">{t("admin.email.skipped")}</Notice>
      ) : null}
      {query.emailFailed ? (
        <Notice tone="error">{t("admin.email.failed")}</Notice>
      ) : null}

      <section className="grid gap-4">
        <AdminNav current="/admin/beta" locale={locale} />
        <p className="text-kicker font-bold uppercase text-ink-soft">
          {t("admin.kicker")}
        </p>
        <h1 className="text-page-title">{t("admin.title")}</h1>
        <p className="max-w-[62ch] text-ink-soft">{t("admin.body")}</p>
      </section>

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Card tactile>
          <CardContent className="p-5">
            <p className="text-sm font-bold text-ink-soft">
              {t("admin.pending")}
            </p>
            <p className="mt-2 font-display text-4xl">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card tactile>
          <CardContent className="p-5">
            <p className="text-sm font-bold text-ink-soft">
              {t("admin.totalReviewable")}
            </p>
            <p className="mt-2 font-display text-4xl">{applications.length}</p>
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-4">
        {applications.length ? (
          applications.map((application) => {
            const platforms = asStringArray(application.platforms);
            const isPending = application.status === BetaTesterStatus.PENDING;

            return (
              <Card tactile key={application.id}>
                <CardContent className="grid gap-5 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-kicker font-bold uppercase text-ink-soft">
                        {statusLabel(application.status, t)}
                      </p>
                      <h2 className="mt-1 font-display text-2xl font-medium">
                        {application.name ??
                          application.user.displayName ??
                          t("admin.noName")}
                      </h2>
                      <p className="mt-1 text-sm text-ink-soft">
                        {application.user.email ?? t("admin.noEmail")}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-ink-soft">
                      {application.createdAt.toLocaleDateString(locale)}
                    </p>
                  </div>

                  <div className="grid gap-2 text-sm text-ink">
                    <p>
                      <strong>{t("admin.platforms")}:</strong>{" "}
                      {platforms.length
                        ? platforms.join(", ")
                        : t("admin.notInformed")}
                    </p>
                    <p>
                      <strong>{t("admin.retrogames")}:</strong>{" "}
                      {application.retroGames || t("admin.notInformed")}
                    </p>
                    {application.justification ? (
                      <p>
                        <strong>{t("admin.justification")}:</strong>{" "}
                        {application.justification}
                      </p>
                    ) : null}
                    {application.accessExpiresAt ? (
                      <p>
                        <strong>{t("admin.accessUntil")}:</strong>{" "}
                        {application.accessExpiresAt.toLocaleDateString(locale)}
                      </p>
                    ) : null}
                  </div>

                  {isPending ? (
                    <form
                      action={reviewBetaApplicationAction}
                      className="grid gap-3"
                    >
                      <input
                        name="applicationId"
                        type="hidden"
                        value={application.id}
                      />
                      <label className="grid gap-2">
                        <span className="text-sm font-bold text-ink">
                          {t("admin.justification")}
                        </span>
                        <textarea
                          className="min-h-24 rounded-inner border border-edge bg-surface px-4 py-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow"
                          maxLength={500}
                          name="justification"
                          required
                        />
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <Button name="decision" type="submit" value="approve">
                          {t("admin.approve")}
                        </Button>
                        <Button
                          name="decision"
                          type="submit"
                          value="reject"
                          variant="outline"
                        >
                          {t("admin.reject")}
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card tactile>
            <CardContent className="p-6">
              <p className="font-semibold">{t("admin.empty")}</p>
            </CardContent>
          </Card>
        )}
      </section>

      <Card tactile>
        <CardContent className="grid gap-4 p-6">
          <div>
            <p className="text-kicker font-bold uppercase text-ink-soft">
              {t("admin.approvedEmails.kicker")}
            </p>
            <h2 className="mt-1 font-display text-2xl font-medium">
              {t("admin.approvedEmails.title")}
            </h2>
          </div>
          {approvedApplications.length ? (
            <div className="grid gap-2">
              {approvedApplications.map((application) => {
                const email = application.user.email;

                return (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-inner border border-edge bg-surface px-4 py-3"
                    key={application.id}
                  >
                    <span className="font-semibold">
                      {application.name ??
                        application.user.displayName ??
                        t("admin.noName")}
                    </span>
                    {email ? (
                      <a
                        className="break-all text-sm font-bold text-ink underline decoration-ink/30 underline-offset-4"
                        href={`mailto:${email}`}
                      >
                        {email}
                      </a>
                    ) : (
                      <span className="text-sm text-ink-soft">
                        {t("admin.noEmail")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm font-semibold text-ink-soft">
              {t("admin.approvedEmails.empty")}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

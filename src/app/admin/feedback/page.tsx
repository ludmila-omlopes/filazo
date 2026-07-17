import { FeedbackStatus, FeedbackType } from "@prisma/client";
import { updateFeedbackStatusAction } from "../actions";
import { AdminNav } from "../admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { getSessionUserWithBeta, isAdminEmail } from "@/lib/beta-access";
import {
  FEEDBACK_STATUS_LABEL_KEYS,
  FEEDBACK_STATUS_ORDER,
  FEEDBACK_TYPE_LABEL_KEYS,
} from "@/lib/feedback";
import { createTranslator, type Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";

type AdminFeedbackSearchParams = Promise<{
  error?: string;
  updated?: string;
}>;

export default async function AdminFeedbackPage({
  searchParams,
}: PageProps<"/admin/feedback"> & {
  searchParams: AdminFeedbackSearchParams;
}) {
  const locale: Locale = await getRequestLocale();
  const t = createTranslator(locale);
  const query = await searchParams;
  const admin = await getSessionUserWithBeta(await getSessionUserId());

  if (!admin || !isAdminEmail(admin.email)) {
    return (
      <main id="main-content" className="mx-auto grid w-full max-w-[860px] gap-6">
        <Notice tone="error">{t("admin.restricted")}</Notice>
        <Button asChild className="w-fit">
          <a href="/api/auth/youtube?next=/admin/feedback">
            {t("admin.signInGoogle")}
          </a>
        </Button>
      </main>
    );
  }

  const feedbackItems = await prisma.feedback.findMany({
    include: {
      user: {
        select: { displayName: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const columns = FEEDBACK_STATUS_ORDER.map((status) => ({
    status,
    items: feedbackItems.filter((item) => item.status === status),
  }));

  return (
    <main id="main-content" className="mx-auto grid w-full max-w-[1280px] gap-8">
      {query.error ? <Notice tone="error">{query.error}</Notice> : null}
      {query.updated ? (
        <Notice tone="success">{t("admin.feedback.updated")}</Notice>
      ) : null}

      <section className="grid gap-4">
        <AdminNav current="/admin/feedback" locale={locale} />
        <p className="text-kicker font-bold uppercase text-ink-soft">
          {t("admin.feedback.kicker")}
        </p>
        <h1 className="text-page-title">{t("admin.feedback.title")}</h1>
        <p className="max-w-[62ch] text-ink-soft">{t("admin.feedback.body")}</p>
      </section>

      <div className="grid grid-cols-4 items-start gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
        {columns.map((column) => (
          <section
            aria-label={t(FEEDBACK_STATUS_LABEL_KEYS[column.status])}
            className="grid gap-3 rounded-card border border-edge bg-surface p-3"
            key={column.status}
          >
            <h2 className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">
              {t(FEEDBACK_STATUS_LABEL_KEYS[column.status])}
            </h2>

            {column.items.length ? (
              column.items.map((item) => (
                <article
                  className="grid gap-3 rounded-inner border border-edge bg-canvas p-4"
                  key={item.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge
                      variant={
                        item.type === FeedbackType.BUG ? "destructive" : "sky"
                      }
                    >
                      {t(FEEDBACK_TYPE_LABEL_KEYS[item.type])}
                    </Badge>
                    <p className="text-xs font-semibold text-ink-soft">
                      {item.createdAt.toLocaleDateString(locale)}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold leading-snug">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                      {item.details}
                    </p>
                  </div>

                  <p className="truncate text-xs font-semibold text-ink-soft">
                    {item.user.displayName ?? t("admin.noName")}
                    {item.user.email ? ` · ${item.user.email}` : ""}
                  </p>

                  <form
                    action={updateFeedbackStatusAction}
                    className="flex flex-wrap gap-2 border-t border-edge pt-3"
                  >
                    <input name="feedbackId" type="hidden" value={item.id} />
                    {FEEDBACK_STATUS_ORDER.filter(
                      (status) => status !== column.status,
                    ).map((status) => (
                      <Button
                        key={status}
                        name="status"
                        size="sm"
                        type="submit"
                        value={status}
                        variant={
                          status === FeedbackStatus.DECLINED
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {t("admin.feedback.moveTo", {
                          status: t(FEEDBACK_STATUS_LABEL_KEYS[status]),
                        })}
                      </Button>
                    ))}
                  </form>
                </article>
              ))
            ) : (
              <p className="px-1 pb-1 text-sm font-semibold text-ink-soft">
                {t("admin.feedback.empty")}
              </p>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}

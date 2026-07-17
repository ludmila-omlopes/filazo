import type { Metadata } from "next";
import { FeedbackType } from "@prisma/client";
import { submitFeedbackAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import {
  FEEDBACK_STATUS_LABEL_KEYS,
  FEEDBACK_TYPE_LABEL_KEYS,
} from "@/lib/feedback";
import { createTranslator, type Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";
import { createPageMetadata } from "@/lib/site-metadata";

type FeedbackSearchParams = Promise<{
  error?: string;
  sent?: string;
}>;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);

  return createPageMetadata({
    title: t("feedback.title"),
    description: t("feedback.body"),
    path: "/feedback",
  });
}

export default async function FeedbackPage({
  searchParams,
}: PageProps<"/feedback"> & { searchParams: FeedbackSearchParams }) {
  const locale: Locale = await getRequestLocale();
  const t = createTranslator(locale);
  const query = await searchParams;
  const userId = await getSessionUserId();

  const submissions = userId
    ? await prisma.feedback.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  return (
    <main id="main-content" className="mx-auto grid w-full max-w-[860px] gap-8">
      {query.error ? <Notice tone="error">{query.error}</Notice> : null}
      {query.sent ? <Notice tone="success">{t("feedback.sent")}</Notice> : null}

      <section className="grid gap-3">
        <p className="text-kicker font-bold uppercase text-ink-soft">
          {t("feedback.kicker")}
        </p>
        <h1 className="text-page-title">{t("feedback.title")}</h1>
        <p className="max-w-[62ch] leading-relaxed text-ink-soft">
          {t("feedback.body")}
        </p>
      </section>

      {!userId ? (
        <Button asChild className="w-fit">
          <a href="/api/auth/youtube?next=/feedback">{t("feedback.signIn")}</a>
        </Button>
      ) : (
        <>
          <Card tactile>
            <CardContent className="p-6">
              <form action={submitFeedbackAction} className="grid gap-5">
                <fieldset className="grid gap-3">
                  <legend className="text-sm font-bold text-ink">
                    {t("feedback.type")}
                  </legend>
                  <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                    <label className="flex items-center gap-3 rounded-inner border border-edge bg-surface px-4 py-3 text-sm font-semibold text-ink">
                      <input
                        className="h-4 w-4 accent-sage"
                        defaultChecked
                        name="type"
                        type="radio"
                        value={FeedbackType.IMPROVEMENT}
                      />
                      {t("feedback.type.improvement")}
                    </label>
                    <label className="flex items-center gap-3 rounded-inner border border-edge bg-surface px-4 py-3 text-sm font-semibold text-ink">
                      <input
                        className="h-4 w-4 accent-sage"
                        name="type"
                        type="radio"
                        value={FeedbackType.BUG}
                      />
                      {t("feedback.type.bug")}
                    </label>
                  </div>
                </fieldset>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-ink">
                    {t("feedback.titleLabel")}
                  </span>
                  <input
                    className="min-h-12 rounded-inner border border-edge bg-surface px-4 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow"
                    maxLength={120}
                    minLength={3}
                    name="title"
                    placeholder={t("feedback.titlePlaceholder")}
                    required
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-ink">
                    {t("feedback.details")}
                  </span>
                  <textarea
                    className="min-h-32 rounded-inner border border-edge bg-surface px-4 py-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow"
                    maxLength={2000}
                    minLength={10}
                    name="details"
                    placeholder={t("feedback.detailsPlaceholder")}
                    required
                  />
                </label>

                <Button className="min-h-12 w-fit px-6" type="submit">
                  {t("feedback.submit")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card tactile>
            <CardContent className="grid gap-4 p-6">
              <h2 className="font-display text-2xl font-medium">
                {t("feedback.mine.title")}
              </h2>
              {submissions.length ? (
                <div className="grid gap-2">
                  {submissions.map((item) => (
                    <div
                      className="grid gap-2 rounded-inner border border-edge bg-surface px-4 py-3"
                      key={item.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{item.title}</p>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              item.type === FeedbackType.BUG
                                ? "destructive"
                                : "sky"
                            }
                          >
                            {t(FEEDBACK_TYPE_LABEL_KEYS[item.type])}
                          </Badge>
                          <Badge variant="outline">
                            {t(FEEDBACK_STATUS_LABEL_KEYS[item.status])}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-ink-soft">
                        {item.details}
                      </p>
                      <p className="text-xs font-semibold text-ink-soft">
                        {item.createdAt.toLocaleDateString(locale)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-semibold text-ink-soft">
                  {t("feedback.mine.empty")}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

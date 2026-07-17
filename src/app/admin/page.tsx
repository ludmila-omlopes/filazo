import Link from "next/link";
import { BetaTesterStatus, FeedbackStatus } from "@prisma/client";
import { AdminNav } from "./admin-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { getSessionUserWithBeta, isAdminEmail } from "@/lib/beta-access";
import {
  createTranslator,
  type Locale,
  type TranslationKey,
} from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";

type AdminSearchParams = Promise<{
  error?: string;
  user?: string;
}>;

export default async function AdminPage({
  searchParams,
}: PageProps<"/admin"> & { searchParams: AdminSearchParams }) {
  const locale: Locale = await getRequestLocale();
  const t = createTranslator(locale);
  const query = await searchParams;
  const admin = await getSessionUserWithBeta(await getSessionUserId());

  if (!admin || !isAdminEmail(admin.email)) {
    return (
      <main id="main-content" className="mx-auto grid w-full max-w-[860px] gap-6">
        <Notice tone="error">{t("admin.restricted")}</Notice>
        <Button asChild className="w-fit">
          <a href="/api/auth/youtube?next=/admin">{t("admin.signInGoogle")}</a>
        </Button>
      </main>
    );
  }

  const userSearch = query.user?.trim() ?? "";
  const [pendingCount, newFeedbackCount, previewUsers] = await Promise.all([
    prisma.betaTesterApplication.count({
      where: { status: BetaTesterStatus.PENDING },
    }),
    prisma.feedback.count({
      where: { status: FeedbackStatus.NEW },
    }),
    userSearch.length >= 2
      ? prisma.user.findMany({
          where: {
            id: { not: admin.id },
            OR: [
              {
                email: {
                  contains: userSearch,
                  mode: "insensitive",
                },
              },
              {
                displayName: {
                  contains: userSearch,
                  mode: "insensitive",
                },
              },
            ],
          },
          select: {
            id: true,
            displayName: true,
            email: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 12,
        })
      : Promise.resolve([]),
  ]);

  const areas = [
    {
      href: "/admin/beta",
      titleKey: "admin.nav.beta",
      bodyKey: "admin.overview.beta.body",
      count: pendingCount,
      countLabelKey: "admin.pending",
    },
    {
      href: "/admin/feedback",
      titleKey: "admin.nav.feedback",
      bodyKey: "admin.overview.feedback.body",
      count: newFeedbackCount,
      countLabelKey: "admin.overview.newFeedback",
    },
    {
      href: "/admin/ai",
      titleKey: "admin.nav.ai",
      bodyKey: "admin.overview.ai.body",
    },
    {
      href: "/admin/activity",
      titleKey: "admin.nav.activity",
      bodyKey: "admin.overview.activity.body",
    },
  ] satisfies Array<{
    href: string;
    titleKey: TranslationKey;
    bodyKey: TranslationKey;
    count?: number;
    countLabelKey?: TranslationKey;
  }>;

  return (
    <main id="main-content" className="mx-auto grid w-full max-w-[1100px] gap-8">
      {query.error ? <Notice tone="error">{query.error}</Notice> : null}

      <section className="grid gap-4">
        <AdminNav current="/admin" locale={locale} />
        <p className="text-kicker font-bold uppercase text-ink-soft">
          {t("admin.kicker")}
        </p>
        <h1 className="text-page-title">{t("admin.overview.title")}</h1>
        <p className="max-w-[62ch] text-ink-soft">{t("admin.overview.body")}</p>
      </section>

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        {areas.map((area) => (
          <Card tactile key={area.href}>
            <CardContent className="grid h-full content-between gap-4 p-6">
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-display text-2xl font-medium">
                    {t(area.titleKey)}
                  </h2>
                  {area.count !== undefined && area.countLabelKey ? (
                    <p className="text-sm font-bold text-ink-soft">
                      {t(area.countLabelKey)}:{" "}
                      <span className="font-display text-xl text-ink">
                        {area.count}
                      </span>
                    </p>
                  ) : null}
                </div>
                <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-ink-soft">
                  {t(area.bodyKey)}
                </p>
              </div>
              <Button asChild className="w-fit" variant="secondary">
                <Link href={area.href}>{t("admin.overview.open")}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card tactile>
        <CardContent className="grid gap-4 p-6">
          <div>
            <p className="text-kicker font-bold uppercase text-ink-soft">
              {t("admin.preview.kicker")}
            </p>
            <h2 className="mt-1 font-display text-2xl font-medium">
              {t("admin.preview.title")}
            </h2>
            <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-soft">
              {t("admin.preview.body")}
            </p>
          </div>

          <form className="flex flex-wrap items-end gap-3" method="get">
            <label className="grid min-w-[min(100%,360px)] flex-1 gap-2">
              <span className="text-sm font-bold text-ink">
                {t("admin.preview.searchLabel")}
              </span>
              <input
                className="min-h-11 rounded-inner border border-edge bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                defaultValue={userSearch}
                minLength={2}
                name="user"
                placeholder={t("admin.preview.searchPlaceholder")}
                type="search"
              />
            </label>
            <Button type="submit">{t("admin.preview.search")}</Button>
          </form>

          {userSearch.length >= 2 ? (
            previewUsers.length ? (
              <div className="grid gap-2">
                {previewUsers.map((user) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-inner border border-edge bg-surface px-4 py-3"
                    key={user.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {user.displayName ?? t("admin.noName")}
                      </p>
                      <p className="truncate text-sm text-ink-soft">
                        {user.email ?? t("admin.noEmail")}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/profile?viewAs=${user.id}`}>
                        {t("admin.preview.open")}
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold text-ink-soft">
                {t("admin.preview.empty")}
              </p>
            )
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

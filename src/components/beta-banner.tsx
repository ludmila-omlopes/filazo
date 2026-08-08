"use client";

import Link from "next/link";
import { useTranslations } from "@/components/locale-provider";

export function BetaBanner({
  discordInviteUrl,
  submissionsOpen,
}: {
  discordInviteUrl: string | null;
  submissionsOpen: boolean;
}) {
  const t = useTranslations();

  return (
    <div className="beta-banner fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-x-2 gap-y-1 border-b border-edge bg-surface/95 px-4 text-sm backdrop-blur-md max-sm:text-xs">
      <p className="text-center font-semibold leading-tight">
        <span>
          {t(
            submissionsOpen
              ? "banner.beta.applicationsOpen"
              : "banner.beta.message",
          )}
        </span>{" "}
        {submissionsOpen ? (
          <>
            <Link
              className="font-bold underline decoration-ink/30 underline-offset-4"
              href="/beta"
            >
              {t("banner.beta.apply")}
            </Link>
            <span aria-hidden> · </span>
          </>
        ) : null}
        <span>{t("banner.beta.testers")}</span>{" "}
        {discordInviteUrl ? (
          <a
            className="font-bold underline decoration-ink/30 underline-offset-4"
            href={discordInviteUrl}
            rel="noreferrer"
            target="_blank"
          >
            {t("banner.beta.discord")}
          </a>
        ) : (
          <span>{t("banner.beta.discord")}</span>
        )}{" "}
        <span>{t("banner.beta.or")}</span>{" "}
        <Link
          className="font-bold underline decoration-ink/30 underline-offset-4"
          href="/feedback"
        >
          {t("banner.beta.feedback")}
        </Link>
        <span>.</span>
      </p>
    </div>
  );
}

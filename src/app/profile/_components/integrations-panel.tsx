import { ExternalProvider } from "@prisma/client";
import Image from "next/image";
import {
  ExternalLink,
  Unplug,
} from "lucide-react";
import { SyncActionForm } from "@/components/sync-action-form";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { hasIgdbConfig } from "@/lib/igdb";
import { createTranslator, type Locale } from "@/lib/i18n";
import { isSteamConfigured } from "@/lib/steam";
import { isXboxConfigured } from "@/lib/xbox";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import {
  connectPlayStationAction,
  detectFinishedGamesAction,
  disconnectProviderAction,
  syncPlayStationLibraryAction,
  syncSteamLibraryAction,
  syncXboxLibraryAction,
} from "../actions";
import type { ProfileData } from "./profile-types";

type ProviderAccount =
  | ProfileData["steamAccount"]
  | ProfileData["playStationAccount"]
  | ProfileData["xboxAccount"];

type SourceProvider =
  | typeof ExternalProvider.STEAM
  | typeof ExternalProvider.PLAYSTATION
  | typeof ExternalProvider.XBOX;

function ConnectionRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-edge pb-3 last:border-b-0 last:pb-0 max-md:flex-col max-md:items-start">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="text-sm font-semibold">{children}</span>
    </div>
  );
}

function DisconnectForm({
  locale,
  provider,
}: {
  locale: Locale;
  provider: ExternalProvider;
}) {
  const t = createTranslator(locale);
  const action = disconnectProviderAction.bind(null, provider);

  return (
    <form action={action}>
      <Button type="submit" variant="ghost" size="sm">
        <Unplug className="h-4 w-4" />
        {t("profile.sources.disconnect")}
      </Button>
    </form>
  );
}

function getSourceState(account: ProviderAccount, locale: Locale) {
  const t = createTranslator(locale);

  if (!account) {
    return {
      label: t("profile.sources.disconnected"),
      tone: "bg-clay-soft text-ink border-clay/35",
      dot: "bg-clay",
    };
  }

  if (!account.lastSyncedAt) {
    return {
      label: t("profile.sources.notSynced"),
      tone: "bg-sand-soft text-ink border-sand/70",
      dot: "bg-sand",
    };
  }

  return {
    label: t("profile.sources.synced", {
      date: formatDate(account.lastSyncedAt, locale),
    }),
    tone: "bg-sage-soft text-ink border-sage/50",
    dot: "bg-sage",
  };
}

const providerLogoSrc: Record<SourceProvider, string> = {
  [ExternalProvider.STEAM]: "/brand/steam-logo.png",
  [ExternalProvider.PLAYSTATION]: "/brand/playstation-logo.png",
  [ExternalProvider.XBOX]: "/brand/xbox-logo.svg",
};

function ProviderLogo({ provider }: { provider: SourceProvider }) {
  return (
    <Image
      alt=""
      className="h-7 w-7 object-contain"
      height={28}
      src={providerLogoSrc[provider]}
      unoptimized
      width={28}
    />
  );
}

function PlayStationConnectionGuide({ locale }: { locale: Locale }) {
  const t = createTranslator(locale);

  return (
    <div className="rounded-inner border border-edge bg-canvas/70 p-4 text-sm leading-relaxed text-ink-soft">
      <p className="font-semibold text-ink">{t("profile.sources.tokenGuide")}</p>
      <ol className="mt-3 grid gap-2">
        <li>{t("profile.sources.tokenStep1")}</li>
        <li>
          {t("profile.sources.tokenStep2Lead")}{" "}
          <a
            className="inline-flex items-center gap-1 font-semibold text-ink underline underline-offset-4"
            href="https://ca.account.sony.com/api/v1/ssocookie"
            rel="noreferrer"
            target="_blank"
          >
            Sony&apos;s NPSSO page
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
          .
        </li>
        <li>{t("profile.sources.tokenStep3")}</li>
      </ol>
      <p className="mt-3 text-xs">{t("profile.sources.tokenBody")}</p>
    </div>
  );
}

function ProviderRow({
  account,
  actions,
  children,
  description,
  eyebrow,
  locale,
  provider,
  title,
}: {
  account: ProviderAccount;
  actions: React.ReactNode;
  children: React.ReactNode;
  description: string;
  eyebrow: string;
  locale: Locale;
  provider: SourceProvider;
  title: string;
}) {
  const t = createTranslator(locale);
  const state = getSourceState(account, locale);

  return (
    <details
      className={cn(
        "group rounded-inner border bg-surface shadow-rest transition-colors",
        account
          ? account.lastSyncedAt
            ? "border-sage/45"
            : "border-sand/70"
          : "border-clay/35",
      )}
    >
      <summary className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-4 p-4 marker:content-[''] max-sm:grid-cols-1">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-inner bg-white p-1">
            <ProviderLogo provider={provider} />
          </span>
          <div className="min-w-0">
            <p className="section-label !mb-1">{eyebrow}</p>
            <h2 className="truncate font-display text-xl font-medium leading-tight">
              {title}
            </h2>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-pill border px-3 py-1 text-xs font-bold",
            state.tone,
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", state.dot)} />
          {state.label}
        </span>
      </summary>

      <div className="grid gap-4 border-t border-edge p-4">
        <p className="max-w-[62ch] text-sm leading-relaxed text-ink-soft">
          {description}
        </p>
        {account ? (
          <ConnectionRow label={t("profile.sources.account")}>
            {account.displayName ?? account.username ?? account.providerAccountId}
          </ConnectionRow>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {actions}
          {account ? <DisconnectForm locale={locale} provider={provider} /> : null}
        </div>
        {children}
      </div>
    </details>
  );
}

function CompletionStatusRow({
  locale,
  profile,
}: {
  locale: Locale;
  profile: ProfileData;
}) {
  const t = createTranslator(locale);
  const canUpdateCompletion = Boolean(
    profile.steamAccount || profile.playStationAccount,
  );

  return (
    <div
      className={cn(
        "rounded-inner border bg-surface p-4 shadow-rest",
        canUpdateCompletion ? "border-sage/45" : "border-clay/35",
      )}
    >
      <div className="grid grid-cols-[1fr_auto] items-center gap-4 max-sm:grid-cols-1">
        <div>
          <p className="section-label !mb-1">{t("profile.completion.label")}</p>
          <h2 className="font-display text-xl font-medium leading-tight">
            {t("profile.completion.title")}
          </h2>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-soft">
            {t("profile.completion.body")}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-pill border px-3 py-1 text-xs font-bold",
            canUpdateCompletion
              ? "border-sage/50 bg-sage-soft text-ink"
              : "border-clay/35 bg-clay-soft text-ink",
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              canUpdateCompletion ? "bg-sage" : "bg-clay",
            )}
          />
          {canUpdateCompletion
            ? t("profile.completion.ready")
            : t("profile.completion.needsSource")}
        </span>
      </div>

      <div className="mt-4">
        {canUpdateCompletion ? (
          <SyncActionForm
            action={detectFinishedGamesAction}
            buttonLabel={t("profile.completion.update")}
            pendingLabel={t("profile.completion.checking")}
            pendingNotice={t("profile.completion.pending")}
          />
        ) : (
          <p className="text-sm font-semibold text-ink-soft">
            {t("profile.completion.connectFirst")}
          </p>
        )}
      </div>
    </div>
  );
}

export function IntegrationsPanel({
  locale,
  profile,
}: {
  locale: Locale;
  profile: ProfileData;
}) {
  const t = createTranslator(locale);

  return (
    <section className="panel bg-sky-soft/55">
      <SectionHeader
        eyebrow={t("profile.sources.label")}
        title={t("profile.sources.title")}
        description={t("profile.sources.description")}
        aside={
          <div className="pill">
            {t("profile.sources.connectedCount", {
              count: formatNumber(profile.user.externalAccounts.length, locale),
            })}
          </div>
        }
      />

      <details className="mb-6 rounded-inner border border-edge bg-surface px-5 py-4 text-sm leading-relaxed text-ink-soft">
        <summary className="cursor-pointer font-bold text-ink">
          {t("profile.sources.disconnectQuestion")}
        </summary>
        <p className="mt-2">{t("profile.sources.disconnectAnswer")}</p>
      </details>

      <div className="grid gap-5">
        <ProviderRow
          account={profile.steamAccount}
          eyebrow="Steam"
          locale={locale}
          provider={ExternalProvider.STEAM}
          title={t("profile.sources.steamTitle")}
          description={t("profile.sources.steamBody")}
          actions={
            profile.steamAccount ? (
              <SyncActionForm
                action={syncSteamLibraryAction}
                buttonLabel={t("profile.sources.refreshSteam")}
                pendingLabel={t("profile.sources.refreshing")}
                pendingNotice={t("profile.sources.steamPending")}
              />
            ) : (
              <Button asChild>
                <a href="/api/auth/steam">{t("profile.sources.connectSteam")}</a>
              </Button>
            )
          }
        >
          <details className="text-sm text-ink-soft">
            <summary className="cursor-pointer font-semibold text-ink">
              {t("profile.sources.technicalStatus")}
            </summary>
            <p className="mt-2">
              {t("profile.sources.steamApiStatus", {
                steam: isSteamConfigured()
                  ? t("profile.sources.steamReady")
                  : t("profile.sources.steamMissingKey"),
                metadata: hasIgdbConfig()
                  ? t("profile.sources.steamReady")
                  : t("profile.sources.igdbMissingKeys"),
              })}
            </p>
          </details>
        </ProviderRow>

        <ProviderRow
          account={profile.playStationAccount}
          eyebrow="PlayStation"
          locale={locale}
          provider={ExternalProvider.PLAYSTATION}
          title={t("profile.sources.playstationTitle")}
          description={t("profile.sources.playstationBody")}
          actions={
            profile.playStationAccount ? (
              <SyncActionForm
                action={syncPlayStationLibraryAction}
                buttonLabel={t("profile.sources.refreshPlayStation")}
                pendingLabel={t("profile.sources.refreshing")}
                pendingNotice={t("profile.sources.playstationPending")}
              />
            ) : null
          }
        >
          {profile.playStationAccount ? (
            <details className="text-sm text-ink-soft">
              <summary className="cursor-pointer font-semibold text-ink">
                {t("profile.sources.technicalStatus")}
              </summary>
              <p className="mt-2">{t("profile.sources.connectedSecurely")}</p>
            </details>
          ) : (
            <form action={connectPlayStationAction} className="grid gap-4 pt-1">
              <PlayStationConnectionGuide locale={locale} />
              <label className="grid gap-2">
                <span className="text-sm font-semibold">{t("profile.sources.npsso")}</span>
                <input
                  className="min-h-11 rounded-inner border border-edge bg-surface px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  name="npsso"
                  type="password"
                  autoComplete="off"
                  placeholder={t("profile.sources.npssoPlaceholder")}
                  required
                />
              </label>
              <Button type="submit">{t("profile.sources.connectPlayStation")}</Button>
            </form>
          )}
        </ProviderRow>

        <ProviderRow
          account={profile.xboxAccount}
          eyebrow="Xbox"
          locale={locale}
          provider={ExternalProvider.XBOX}
          title={t("profile.sources.xboxTitle")}
          description={t("profile.sources.xboxBody")}
          actions={
            profile.xboxAccount ? (
              <SyncActionForm
                action={syncXboxLibraryAction}
                buttonLabel={t("profile.sources.refreshXbox")}
                pendingLabel={t("profile.sources.refreshing")}
                pendingNotice={t("profile.sources.xboxPending")}
              />
            ) : isXboxConfigured() ? (
              <Button asChild>
                <a href="/api/auth/xbox">{t("profile.sources.connectXbox")}</a>
              </Button>
            ) : (
              <Button disabled variant="ghost">
                {t("profile.sources.xboxUnavailable")}
              </Button>
            )
          }
        >
          <details className="text-sm text-ink-soft">
            <summary className="cursor-pointer font-semibold text-ink">
              {t("profile.sources.technicalStatus")}
            </summary>
            <p className="mt-2">
              {t("profile.sources.oauthStatus", {
                status: isXboxConfigured()
                  ? t("profile.sources.oauthReady")
                  : t("profile.sources.oauthMissing"),
              })}
            </p>
          </details>
        </ProviderRow>

        <CompletionStatusRow locale={locale} profile={profile} />
      </div>

      <div className="mt-6 rounded-inner border border-edge bg-surface p-5 text-sm leading-relaxed text-ink-soft">
        {t("profile.sources.csvNotice")}
      </div>
    </section>
  );
}

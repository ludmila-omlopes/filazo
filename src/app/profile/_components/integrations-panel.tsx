import { ExternalProvider } from "@prisma/client";
import Image from "next/image";
import {
  ExternalLink,
  Unplug,
} from "lucide-react";
import { CsvImportWidget } from "@/components/csv-import-widget";
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
  importCsvAction,
  importPhotoCatalogAction,
  syncPlayStationLibraryAction,
  syncSteamLibraryAction,
  syncUserReviewsAction,
  syncXboxLibraryAction,
} from "../actions";
import { ManualGameLookupPanel } from "./manual-game-lookup-panel";
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

function CsvImportRow({ profile }: { profile: ProfileData }) {
  return (
    <div className="rounded-inner border border-edge bg-surface p-5 shadow-rest">
      <SectionHeader
        eyebrow="File import"
        title="Upload a CSV"
        aside={
          profile.latestImport ? (
            <div className="pill">
              Latest import: {formatDate(profile.latestImport.createdAt)}
            </div>
          ) : null
        }
      />
      <CsvImportWidget action={importCsvAction} />
      <ImportAuditPreview profile={profile} />
    </div>
  );
}

function getRawTitle(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const title = (value as { title?: unknown }).title;
  return typeof title === "string" ? title : null;
}

function ImportAuditPreview({ profile }: { profile: ProfileData }) {
  const rows = profile.latestImport?.rows ?? [];
  if (!rows.length) {
    return null;
  }

  return (
    <details className="mt-5 rounded-inner border border-edge bg-canvas/60 p-4 text-sm">
      <summary className="cursor-pointer font-bold">
        Recent import audit
      </summary>
      <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-inner border border-edge bg-surface p-3"
            key={row.id}
          >
            <span className="min-w-0 truncate font-semibold">
              {getRawTitle(row.rawData) ??
                row.normalizedTitle ??
                `Row ${row.rowIndex + 1}`}
            </span>
            <span className="rounded-pill border border-edge px-2 py-0.5 text-[0.7rem] font-bold uppercase">
              {row.outcome ?? "pending"}
            </span>
            {row.error ? (
              <p className="col-span-2 text-xs leading-relaxed text-ink-soft">
                {row.error}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </details>
  );
}

function PhotoImportRow({ profile }: { profile: ProfileData }) {
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);

  return (
    <div className="rounded-inner border border-edge bg-surface p-5 shadow-rest">
      <SectionHeader
        eyebrow="Photo import"
        title="Read games from screenshots"
        description="Upload screenshots or photos of a catalog page, shelf, or list. Detected titles are resolved into the same canonical catalog."
        aside={
          <div className={cn("pill", !aiConfigured && "bg-clay-soft")}>
            {aiConfigured ? "Vision ready" : "Needs AI key"}
          </div>
        }
      />
      <form
        action={importPhotoCatalogAction}
        className="grid gap-4"
      >
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Catalog images</span>
          <input
            accept="image/*"
            className="w-full file:mr-3 file:cursor-pointer file:rounded-pill file:border file:border-edge file:bg-sage-soft file:px-4 file:py-2 file:font-semibold file:transition-colors hover:file:bg-sand-soft"
            multiple
            name="images"
            type="file"
          />
        </label>
        {!aiConfigured ? (
          <p className="text-sm font-semibold text-clay">
            Photo extraction needs <code>OPENAI_API_KEY</code>. Upload attempts
            are kept in the import audit with a clear skipped state.
          </p>
        ) : null}
        <Button type="submit">Import from photos</Button>
      </form>
      <ImportAuditPreview profile={profile} />
    </div>
  );
}

function ReviewSyncRow({ profile }: { profile: ProfileData }) {
  const canSyncReviews = Boolean(profile.steamAccount);

  return (
    <div
      className={cn(
        "rounded-inner border bg-surface p-4 shadow-rest",
        canSyncReviews ? "border-sage/45" : "border-clay/35",
      )}
    >
      <div className="grid grid-cols-[1fr_auto] items-center gap-4 max-sm:grid-cols-1">
        <div>
          <p className="section-label !mb-1">Review import</p>
          <h2 className="font-display text-xl font-medium leading-tight">
            Bring in your public reviews
          </h2>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-soft">
            Steam public recommendations can be matched back to games already on
            your shelf. PlayStation and Xbox reviews are not exposed through the
            current source flows.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-pill border px-3 py-1 text-xs font-bold",
            canSyncReviews
              ? "border-sage/50 bg-sage-soft text-ink"
              : "border-clay/35 bg-clay-soft text-ink",
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              canSyncReviews ? "bg-sage" : "bg-clay",
            )}
          />
          {canSyncReviews ? "Steam ready" : "Needs Steam"}
        </span>
      </div>

      <div className="mt-4">
        {canSyncReviews ? (
          <SyncActionForm
            action={syncUserReviewsAction}
            buttonLabel="Sync reviews"
            pendingLabel="Checking..."
            pendingNotice="Checking public Steam recommendations."
          />
        ) : (
          <p className="text-sm font-semibold text-ink-soft">
            Connect Steam first.
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

        <ReviewSyncRow profile={profile} />

        <ManualGameLookupPanel enabled={hasIgdbConfig()} />

        <PhotoImportRow profile={profile} />

        <CsvImportRow profile={profile} />
      </div>
    </section>
  );
}

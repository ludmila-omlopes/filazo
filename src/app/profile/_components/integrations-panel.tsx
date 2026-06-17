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
import { isSteamConfigured } from "@/lib/steam";
import { isXboxConfigured } from "@/lib/xbox";
import { cn, formatDate } from "@/lib/utils";
import {
  connectPlayStationAction,
  detectFinishedGamesAction,
  disconnectProviderAction,
  importCsvAction,
  syncPlayStationLibraryAction,
  syncSteamLibraryAction,
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
  provider,
}: {
  provider: ExternalProvider;
}) {
  const action = disconnectProviderAction.bind(null, provider);

  return (
    <form action={action}>
      <Button type="submit" variant="ghost" size="sm">
        <Unplug className="h-4 w-4" />
        Disconnect
      </Button>
    </form>
  );
}

function getSourceState(account: ProviderAccount) {
  if (!account) {
    return {
      label: "Disconnected",
      tone: "bg-clay-soft text-ink border-clay/35",
      dot: "bg-clay",
    };
  }

  if (!account.lastSyncedAt) {
    return {
      label: "Not synced",
      tone: "bg-sand-soft text-ink border-sand/70",
      dot: "bg-sand",
    };
  }

  return {
    label: `Synced ${formatDate(account.lastSyncedAt)}`,
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
      alt={`${provider} logo`}
      className="h-7 w-7 object-contain"
      height={28}
      src={providerLogoSrc[provider]}
      unoptimized
      width={28}
    />
  );
}

function PlayStationConnectionGuide() {
  return (
    <div className="rounded-inner border border-edge bg-canvas/70 p-4 text-sm leading-relaxed text-ink-soft">
      <p className="font-semibold text-ink">How to get the token</p>
      <ol className="mt-3 grid gap-2">
        <li>1. Sign in to PlayStation in your browser.</li>
        <li>
          2. Open{" "}
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
        <li>
          3. Copy the token value from the response and paste it below. Pasting
          the whole response works too.
        </li>
      </ol>
      <p className="mt-3 text-xs">
        The token is temporary. Filazo exchanges it for a secure connection and
        does not keep the pasted value.
      </p>
    </div>
  );
}

function ProviderRow({
  account,
  actions,
  children,
  description,
  eyebrow,
  provider,
  title,
}: {
  account: ProviderAccount;
  actions: React.ReactNode;
  children: React.ReactNode;
  description: string;
  eyebrow: string;
  provider: SourceProvider;
  title: string;
}) {
  const state = getSourceState(account);

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
          <ConnectionRow label="Account">
            {account.displayName ?? account.username ?? account.providerAccountId}
          </ConnectionRow>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {actions}
          {account ? <DisconnectForm provider={provider} /> : null}
        </div>
        {children}
      </div>
    </details>
  );
}

function CompletionStatusRow({ profile }: { profile: ProfileData }) {
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
          <p className="section-label !mb-1">Completion status</p>
          <h2 className="font-display text-xl font-medium leading-tight">
            Update finished games
          </h2>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-soft">
            Check connected achievements and trophies for games that look
            complete.
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
          {canUpdateCompletion ? "Ready" : "Needs Steam or PlayStation"}
        </span>
      </div>

      <div className="mt-4">
        {canUpdateCompletion ? (
          <SyncActionForm
            action={detectFinishedGamesAction}
            buttonLabel="Update completion"
            pendingLabel="Checking..."
            pendingNotice="Checking completion status. Large libraries can take a few minutes."
          />
        ) : (
          <p className="text-sm font-semibold text-ink-soft">
            Connect Steam or PlayStation first.
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
    </div>
  );
}

export function IntegrationsPanel({ profile }: { profile: ProfileData }) {
  return (
    <section className="panel bg-sky-soft/55">
      <SectionHeader
        eyebrow="Sources"
        title="Add or refresh your games"
        description="Connect the places where you already play. Your shelf stays intact if a source is removed later."
        aside={
          <div className="pill">
            {profile.user.externalAccounts.length} connected
          </div>
        }
      />

      <details className="mb-6 rounded-inner border border-edge bg-surface px-5 py-4 text-sm leading-relaxed text-ink-soft">
        <summary className="cursor-pointer font-bold text-ink">
          What happens when a source is disconnected?
        </summary>
        <p className="mt-2">
          Filazo removes the account connection, but keeps the games already on
          your shelf.
        </p>
      </details>

      <div className="grid gap-5">
        <ProviderRow
          account={profile.steamAccount}
          eyebrow="Steam"
          provider={ExternalProvider.STEAM}
          title="Steam library"
          description="Bring in owned games, playtime, recently played dates, and progress."
          actions={
            profile.steamAccount ? (
              <SyncActionForm
                action={syncSteamLibraryAction}
                buttonLabel="Refresh Steam"
                pendingLabel="Refreshing..."
                pendingNotice="Steam is refreshing your library. Keep this page open."
              />
            ) : (
              <Button asChild>
                <a href="/api/auth/steam">Connect Steam</a>
              </Button>
            )
          }
        >
          <details className="text-sm text-ink-soft">
            <summary className="cursor-pointer font-semibold text-ink">
              Technical status
            </summary>
            <p className="mt-2">
              Steam API {isSteamConfigured() ? "ready" : "missing key"} {" / "}
              Game metadata {hasIgdbConfig() ? "ready" : "missing keys"}
            </p>
          </details>
        </ProviderRow>

        <ProviderRow
          account={profile.playStationAccount}
          eyebrow="PlayStation"
          provider={ExternalProvider.PLAYSTATION}
          title="PlayStation library"
          description="Bring in purchased games and trophy-title history."
          actions={
            profile.playStationAccount ? (
              <SyncActionForm
                action={syncPlayStationLibraryAction}
                buttonLabel="Refresh PlayStation"
                pendingLabel="Refreshing..."
                pendingNotice="PlayStation is refreshing your library."
              />
            ) : null
          }
        >
          {profile.playStationAccount ? (
            <details className="text-sm text-ink-soft">
              <summary className="cursor-pointer font-semibold text-ink">
                Technical status
              </summary>
              <p className="mt-2">Connected token stored securely.</p>
            </details>
          ) : (
            <form action={connectPlayStationAction} className="grid gap-4 pt-1">
              <PlayStationConnectionGuide />
              <label className="grid gap-2">
                <span className="text-sm font-semibold">NPSSO token</span>
                <input
                  className="min-h-11 rounded-inner border border-edge bg-surface px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  name="npsso"
                  type="password"
                  autoComplete="off"
                  placeholder="Paste token or {&quot;npsso&quot;:&quot;...&quot;}"
                  required
                />
              </label>
              <Button type="submit">Connect PlayStation</Button>
            </form>
          )}
        </ProviderRow>

        <ProviderRow
          account={profile.xboxAccount}
          eyebrow="Xbox"
          provider={ExternalProvider.XBOX}
          title="Xbox library"
          description="Bring in achievement-title and recently played history."
          actions={
            profile.xboxAccount ? (
              <SyncActionForm
                action={syncXboxLibraryAction}
                buttonLabel="Refresh Xbox"
                pendingLabel="Refreshing..."
                pendingNotice="Xbox is refreshing your library."
              />
            ) : isXboxConfigured() ? (
              <Button asChild>
                <a href="/api/auth/xbox">Connect Xbox</a>
              </Button>
            ) : (
              <Button disabled variant="ghost">
                Xbox unavailable
              </Button>
            )
          }
        >
          <details className="text-sm text-ink-soft">
            <summary className="cursor-pointer font-semibold text-ink">
              Technical status
            </summary>
            <p className="mt-2">
              OAuth {isXboxConfigured() ? "ready" : "missing client ID"}
            </p>
          </details>
        </ProviderRow>

        <CompletionStatusRow profile={profile} />

        <ManualGameLookupPanel enabled={hasIgdbConfig()} />

        <CsvImportRow profile={profile} />
      </div>
    </section>
  );
}

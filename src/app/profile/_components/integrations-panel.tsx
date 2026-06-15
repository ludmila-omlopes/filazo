import { ExternalProvider } from "@prisma/client";
import { Cable, CircleCheck, CircleDashed, Unplug } from "lucide-react";
import { SyncActionForm } from "@/components/sync-action-form";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SectionHeader } from "@/components/ui/section-header";
import { hasIgdbConfig } from "@/lib/igdb";
import { isSteamConfigured } from "@/lib/steam";
import { isXboxConfigured } from "@/lib/xbox";
import { formatDate } from "@/lib/utils";
import {
  connectPlayStationAction,
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

function ProviderStatus({ account }: { account: ProviderAccount }) {
  return (
    <span className="inline-flex items-center gap-2">
      {account ? (
        <>
          <CircleCheck className="h-4 w-4 text-sage" />
          Connected
        </>
      ) : (
        <>
          <CircleDashed className="h-4 w-4 text-ink-soft" />
          Not connected
        </>
      )}
    </span>
  );
}

function ProviderCard({
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
  provider: ExternalProvider;
  title: string;
}) {
  return (
    <article className="rounded-inner border border-edge bg-surface p-5 shadow-rest">
      <div className="mb-5 flex items-start justify-between gap-4 max-sm:flex-col">
        <div className="flex items-start gap-3">
          <span className="mt-1 grid h-10 w-10 place-items-center rounded-inner bg-canvas text-ink">
            <Cable className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="section-label">{eyebrow}</p>
            <h2 className="font-display text-2xl font-medium leading-tight">
              {title}
            </h2>
            <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-ink-soft">
              {description}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 max-sm:justify-start">
          {actions}
          {account ? <DisconnectForm provider={provider} /> : null}
        </div>
      </div>

      <div className="grid gap-3">
        <ConnectionRow label="Status">
          <ProviderStatus account={account} />
        </ConnectionRow>
        <ConnectionRow label="Account">
          {account?.displayName ?? account?.username ?? account?.providerAccountId ?? "None"}
        </ConnectionRow>
        <ConnectionRow label="Last sync">
          {account?.lastSyncedAt ? formatDate(account.lastSyncedAt) : "Not synced yet"}
        </ConnectionRow>
        {children}
      </div>
    </article>
  );
}

export function IntegrationsPanel({ profile }: { profile: ProfileData }) {
  return (
    <section className="panel bg-sky-soft/55">
      <SectionHeader
        eyebrow="Integrations"
        title="Connect the accounts that feed your catalog"
        aside={
          <div className="pill">
            {profile.user.externalAccounts.length} connected
          </div>
        }
      />

      <Notice tone="info" className="mb-6">
        Disconnecting a provider removes the external account token or link, but
        keeps existing games and import history in your catalog.
      </Notice>

      <div className="grid gap-5">
        <ProviderCard
          account={profile.steamAccount}
          eyebrow="Steam"
          provider={ExternalProvider.STEAM}
          title="Steam library"
          description="Steam signs you in with OpenID. Owned games, playtime, last played dates, and achievement progress sync through the canonical resolver."
          actions={
            profile.steamAccount ? (
              <SyncActionForm
                action={syncSteamLibraryAction}
                buttonLabel="Sync Steam"
                pendingLabel="Syncing Steam..."
                pendingNotice="Steam sync is running. Keep this page open until the library refresh finishes."
              />
            ) : (
              <Button asChild>
                <a href="/api/auth/steam">Connect Steam</a>
              </Button>
            )
          }
        >
          <ConnectionRow label="Configuration">
            Steam API {isSteamConfigured() ? "ready" : "missing key"} {" / "}
            IGDB {hasIgdbConfig() ? "ready" : "missing keys"}
          </ConnectionRow>
        </ProviderCard>

        <ProviderCard
          account={profile.playStationAccount}
          eyebrow="PlayStation"
          provider={ExternalProvider.PLAYSTATION}
          title="PlayStation played catalog"
          description="PlayStation uses a temporary NPSSO exchange, stores encrypted refresh tokens, and syncs purchased games plus trophy-title history."
          actions={
            profile.playStationAccount ? (
              <SyncActionForm
                action={syncPlayStationLibraryAction}
                buttonLabel="Sync PlayStation"
                pendingLabel="Syncing PSN..."
                pendingNotice="PlayStation sync is running while purchased games and trophy titles attach to your catalog."
              />
            ) : null
          }
        >
          {profile.playStationAccount ? (
            <ConnectionRow label="Configuration">
              NPSSO exchanged; refresh token stored encrypted
            </ConnectionRow>
          ) : (
            <form action={connectPlayStationAction} className="grid gap-4 pt-1">
              <p className="text-sm leading-relaxed text-ink-soft">
                Sign in to PlayStation, open the NPSSO page, then paste the
                temporary token value here. The token is exchanged and discarded.
              </p>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">NPSSO token</span>
                <input
                  className="min-h-11 rounded-inner border border-edge bg-surface px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  name="npsso"
                  type="password"
                  autoComplete="off"
                  placeholder="Paste npsso value only"
                  required
                />
              </label>
              <Button type="submit">Connect PlayStation</Button>
            </form>
          )}
        </ProviderCard>

        <ProviderCard
          account={profile.xboxAccount}
          eyebrow="Xbox"
          provider={ExternalProvider.XBOX}
          title="Xbox achievement history"
          description="Xbox signs in through Microsoft OAuth, stores encrypted refresh tokens, and syncs achievement-title and recent-title history."
          actions={
            profile.xboxAccount ? (
              <SyncActionForm
                action={syncXboxLibraryAction}
                buttonLabel="Sync Xbox"
                pendingLabel="Syncing Xbox..."
                pendingNotice="Xbox sync is running while played titles attach to your catalog."
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
          <ConnectionRow label="Configuration">
            OAuth {isXboxConfigured() ? "ready" : "missing client ID"}
          </ConnectionRow>
        </ProviderCard>
      </div>

      <div className="mt-6 rounded-inner border border-edge bg-surface p-5 text-sm leading-relaxed text-ink-soft">
        CSV imports are managed from Overview because they are file uploads
        rather than persistent accounts. PlayStation and Xbox CSV modes still
        attach provider IDs through <code>GameProviderLink</code> when mapped.
      </div>
    </section>
  );
}

import { CsvImportWidget } from "@/components/csv-import-widget";
import { SyncActionForm } from "@/components/sync-action-form";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { hasIgdbConfig } from "@/lib/igdb";
import { isSteamConfigured } from "@/lib/steam";
import { isXboxConfigured } from "@/lib/xbox";
import { formatDate } from "@/lib/utils";
import {
  connectPlayStationAction,
  importCsvAction,
  syncPlayStationLibraryAction,
  syncSteamLibraryAction,
  syncXboxLibraryAction,
} from "../actions";
import type { ProfileData } from "./profile-types";

function ConnectionRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3.5 border-b border-edge pb-3 last:border-b-0 last:pb-0 max-lg:flex-col max-lg:items-start">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="text-sm font-semibold">{children}</span>
    </div>
  );
}

export function AddGamesPanel({ profile }: { profile: ProfileData }) {
  return (
    <section className="panel bg-sand-soft/55">
      <SectionHeader
        eyebrow="Add records"
        title="Bring more games into the catalog"
        aside={
          <div className="pill">
            {profile.latestImport
              ? `Latest import: ${formatDate(profile.latestImport.createdAt)}`
              : "Ready when you are"}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
        <article className="rounded-inner border border-edge bg-surface p-5 shadow-rest">
          <SectionHeader
            eyebrow="Steam"
            title="Library sync"
            aside={
              profile.steamAccount ? (
                <SyncActionForm
                  action={syncSteamLibraryAction}
                  buttonLabel="Sync Steam library"
                  pendingLabel="Syncing Steam..."
                  pendingNotice="Steam sync is running. Keep this page open until the library refresh finishes."
                />
              ) : (
                <Button asChild>
                  <a href="/api/auth/steam">Connect Steam</a>
                </Button>
              )
            }
          />
          <div className="grid gap-3">
            <ConnectionRow label="Status">
              {profile.steamAccount ? "Connected" : "Not connected"}
            </ConnectionRow>
            <ConnectionRow label="Last sync">
              {profile.steamAccount?.lastSyncedAt
                ? formatDate(profile.steamAccount.lastSyncedAt)
                : "Not synced yet"}
            </ConnectionRow>
            <ConnectionRow label="Config">
              Steam API {isSteamConfigured() ? "ready" : "missing key"} {" / "}
              IGDB {hasIgdbConfig() ? "ready" : "missing keys"}
            </ConnectionRow>
          </div>
        </article>

        <article className="rounded-inner border border-edge bg-surface p-5 shadow-rest">
          <SectionHeader
            eyebrow="Xbox"
            title="Achievement-history sync"
            aside={
              profile.xboxAccount ? (
                <SyncActionForm
                  action={syncXboxLibraryAction}
                  buttonLabel="Sync Xbox"
                  pendingLabel="Syncing Xbox..."
                  pendingNotice="Xbox sync is running. Keep this page open while played titles are attached to your catalog."
                />
              ) : isXboxConfigured() ? (
                <Button asChild>
                  <a href="/api/auth/xbox">Connect Xbox</a>
                </Button>
              ) : null
            }
          />
          <div className="grid gap-3">
            <ConnectionRow label="Status">
              {profile.xboxAccount ? "Connected" : "Not connected"}
            </ConnectionRow>
            <ConnectionRow label="Last sync">
              {profile.xboxAccount?.lastSyncedAt
                ? formatDate(profile.xboxAccount.lastSyncedAt)
                : "Not synced yet"}
            </ConnectionRow>
            <ConnectionRow label="Config">
              OAuth {isXboxConfigured() ? "ready" : "missing client ID"}
            </ConnectionRow>
            <p className="text-sm leading-relaxed text-ink-soft">
              Xbox brings in games found through achievement and recent title
              history, then attaches them to the canonical catalog.
            </p>
          </div>
        </article>

        <article className="rounded-inner border border-edge bg-surface p-5 shadow-rest">
          <SectionHeader
            eyebrow="PlayStation"
            title="Played catalog sync"
            aside={
              profile.playStationAccount ? (
                <SyncActionForm
                  action={syncPlayStationLibraryAction}
                  buttonLabel="Sync PlayStation"
                  pendingLabel="Syncing PSN..."
                  pendingNotice="PlayStation sync is running. Keep this page open while purchased games and trophy titles are attached to your catalog."
                />
              ) : null
            }
          />
          <div className="grid gap-3">
            <ConnectionRow label="Status">
              {profile.playStationAccount ? "Connected" : "Not connected"}
            </ConnectionRow>
            <ConnectionRow label="Last sync">
              {profile.playStationAccount?.lastSyncedAt
                ? formatDate(profile.playStationAccount.lastSyncedAt)
                : "Not synced yet"}
            </ConnectionRow>
            {profile.playStationAccount ? (
              <p className="text-sm leading-relaxed text-ink-soft">
                Sync imports PS4/PS5 purchased games and trophy-list titles,
                then attaches them to the shared catalog.
              </p>
            ) : (
              <form action={connectPlayStationAction} className="grid gap-4">
                <p className="text-sm leading-relaxed text-ink-soft">
                  Sign in to PlayStation, open the NPSSO page, then paste the
                  temporary token value here.
                </p>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">NPSSO token</span>
                  <input
                    className="min-h-11 rounded-inner border border-edge bg-surface px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
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
          </div>
        </article>

        <article className="rounded-inner border border-edge bg-surface p-5 shadow-rest">
          <SectionHeader eyebrow="CSV" title="Library exports" />
          <CsvImportWidget action={importCsvAction} />
        </article>
      </div>
    </section>
  );
}

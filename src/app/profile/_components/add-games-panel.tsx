import { CsvImportWidget } from "@/components/csv-import-widget";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { formatDate } from "@/lib/utils";
import {
  importCsvAction,
} from "../actions";
import type { ProfileData } from "./profile-types";

export function AddGamesPanel({ profile }: { profile: ProfileData }) {
  return (
    <section className="panel bg-sand-soft/55">
      <SectionHeader
        eyebrow="Add games"
        title="Bring another shelf in"
        aside={
          <div className="pill">
            {profile.latestImport
              ? `Latest import: ${formatDate(profile.latestImport.createdAt)}`
              : "Ready when you are"}
          </div>
        }
      />

      <div className="grid grid-cols-[0.9fr_1.1fr] gap-6 max-lg:grid-cols-1">
        <article className="rounded-inner border border-edge bg-surface p-5 shadow-rest">
          <SectionHeader
            eyebrow="Sources"
            title="Steam, PlayStation, and Xbox"
            aside={<Button asChild><a href="/profile?tab=integrations">Manage sources</a></Button>}
          />
          <p className="text-sm leading-relaxed text-ink-soft">
            Connect a source once, then refresh it when you want newer playtime
            or recently played games.
          </p>
          <p className="mt-4 text-sm font-semibold">
            {profile.user.externalAccounts.length} connected source
            {profile.user.externalAccounts.length === 1 ? "" : "s"}
          </p>
        </article>

        <article className="rounded-inner border border-edge bg-surface p-5 shadow-rest">
          <SectionHeader eyebrow="File import" title="Upload a CSV" />
          <CsvImportWidget action={importCsvAction} />
        </article>
      </div>
    </section>
  );
}

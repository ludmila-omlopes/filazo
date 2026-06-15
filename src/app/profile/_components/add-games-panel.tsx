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

      <div className="grid grid-cols-[0.9fr_1.1fr] gap-6 max-lg:grid-cols-1">
        <article className="rounded-inner border border-edge bg-surface p-5 shadow-rest">
          <SectionHeader
            eyebrow="Accounts"
            title="Provider connections"
            aside={<Button asChild><a href="/profile?tab=integrations">Manage integrations</a></Button>}
          />
          <p className="text-sm leading-relaxed text-ink-soft">
            Steam, PlayStation, and Xbox now live in a dedicated integrations
            area with connection, sync, and disconnect controls.
          </p>
          <p className="mt-4 text-sm font-semibold">
            {profile.user.externalAccounts.length} connected provider
            {profile.user.externalAccounts.length === 1 ? "" : "s"}
          </p>
        </article>

        <article className="rounded-inner border border-edge bg-surface p-5 shadow-rest">
          <SectionHeader eyebrow="CSV" title="Library exports" />
          <CsvImportWidget action={importCsvAction} />
        </article>
      </div>
    </section>
  );
}

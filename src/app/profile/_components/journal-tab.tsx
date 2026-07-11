import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import {
  createJournalEntryAction,
  deleteJournalEntryAction,
} from "../actions";
import { JournalComposer } from "./journal-composer";
import { JournalForm } from "./journal-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import type { AiSettingsValues } from "@/lib/ai-settings";
import { createTranslator, type Locale } from "@/lib/i18n";
import { cn, formatDate } from "@/lib/utils";
import type { ProfileData, ProfileEntry } from "./profile-types";

type JournalEntry = ProfileData["user"]["journalEntries"][number];

function uniqueEntries(entries: Array<ProfileEntry | null | undefined>) {
  const seen = new Set<string>();
  const unique: ProfileEntry[] = [];

  for (const entry of entries) {
    if (!entry || seen.has(entry.id)) {
      continue;
    }

    seen.add(entry.id);
    unique.push(entry);
  }

  return unique;
}

function buildEntryHref(entryId: string) {
  return `/profile?tab=journal&entryId=${entryId}`;
}

function GameChoice({
  entry,
  isActive,
}: {
  entry: ProfileEntry;
  isActive: boolean;
}) {
  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-inner border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        isActive
          ? "border-ink bg-ink text-surface"
          : "border-edge bg-surface text-ink hover:bg-canvas",
      )}
      href={buildEntryHref(entry.id)}
    >
      <span
        className={cn(
          "grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-[8px] border text-sm font-bold",
          isActive ? "border-surface/20 bg-surface/15" : "border-edge bg-canvas",
        )}
      >
        {entry.game.coverUrl ? (
          <Image
            alt=""
            className="h-full w-full object-cover"
            height={80}
            src={entry.game.coverUrl}
            width={80}
          />
        ) : (
          entry.game.name.slice(0, 1)
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">
          {entry.game.name}
        </span>
        <span
          className={cn(
            "block truncate text-xs font-semibold",
            isActive ? "text-surface/65" : "text-ink-soft",
          )}
        >
          {entry.platformName ?? entry.status.toLowerCase()}
        </span>
      </span>
    </Link>
  );
}

function JournalPageCard({
  entry,
  locale,
}: {
  entry: JournalEntry;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  return (
    <article className="rounded-card border border-edge bg-surface p-5 shadow-rest max-sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-label !mb-1">
            <time dateTime={entry.occurredAt.toISOString()}>
              {formatDate(entry.occurredAt)}
            </time>
          </p>
          <h3 className="text-balance font-display text-xl font-medium">
            {entry.title ?? t("journal.untitledPage")}
          </h3>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link href={`/games/${entry.game.slug}`}>
            {t("journal.openGame")}
            <ChevronRight />
          </Link>
        </Button>
      </div>

      {entry.body ? (
        <p className="mt-4 whitespace-pre-line break-words text-[0.98rem] leading-relaxed text-ink/90">
          {entry.body}
        </p>
      ) : null}

      {entry.audioTranscript ? (
        <div className="mt-4 rounded-inner border border-edge bg-canvas/70 p-3">
          <p className="section-label !mb-2">{t("voiceMemory.label")}</p>
          <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink-soft">
            {entry.audioTranscript}
          </p>
        </div>
      ) : null}

      {entry.media.length ? (
        <div className="mt-4 grid gap-3">
          <p className="section-label !mb-0">{t("journal.keepsakes")}</p>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            {entry.media.map((media) =>
              media.kind === "image" ? (
                <figure
                  className="rounded-inner border border-edge bg-canvas p-2"
                  key={media.id}
                >
                  <Image
                    alt={media.caption ?? `Diary media for ${entry.game.name}`}
                    className="h-auto w-full rounded-[6px] object-cover"
                    height={360}
                    loading="lazy"
                    src={media.url}
                    unoptimized
                    width={640}
                  />
                  {media.caption ? (
                    <figcaption className="mt-2 break-words text-xs font-semibold text-ink-soft">
                      {media.caption}
                    </figcaption>
                  ) : null}
                </figure>
              ) : (
                <div
                  className="rounded-inner border border-edge bg-canvas p-3"
                  key={media.id}
                >
                  <audio className="w-full" controls src={media.url} />
                  {media.caption ? (
                    <p className="mt-2 break-words text-xs font-semibold text-ink-soft">
                      {media.caption}
                    </p>
                  ) : null}
                </div>
              ),
            )}
          </div>
        </div>
      ) : null}

      <details className="group mt-4 border-t border-edge pt-3">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface [&::-webkit-details-marker]:hidden">
          <Trash2 className="h-3.5 w-3.5" />
          {t("journal.deletePage")}
        </summary>
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-inner border border-edge bg-canvas/70 p-3">
          <p className="min-w-0 flex-1 text-xs font-semibold text-ink-soft">
            {t("journal.deleteConfirm")}
          </p>
          <form action={deleteJournalEntryAction}>
            <input name="journalEntryId" type="hidden" value={entry.id} />
            <input name="slug" type="hidden" value={entry.game.slug} />
            <input
              name="returnTo"
              type="hidden"
              value={`${buildEntryHref(entry.userGameEntryId)}&journal=deleted`}
            />
            <Button size="sm" type="submit" variant="destructive">
              <Trash2 />
              {t("journal.deleteConfirmButton")}
            </Button>
          </form>
        </div>
      </details>
    </article>
  );
}

export function JournalTab({
  activeEntryId,
  aiSettings,
  locale,
  profile,
}: {
  activeEntryId: string | null;
  aiSettings: AiSettingsValues;
  locale: Locale;
  profile: ProfileData;
}) {
  const t = createTranslator(locale);
  const selectedEntry = activeEntryId
    ? (profile.user.gameEntries.find((entry) => entry.id === activeEntryId) ??
      null)
    : null;
  const latestPageByEntryId = new Map<string, JournalEntry>();
  for (const page of profile.user.journalEntries) {
    if (!latestPageByEntryId.has(page.userGameEntryId)) {
      latestPageByEntryId.set(page.userGameEntryId, page);
    }
  }
  const gamesWithPages = [...latestPageByEntryId.values()];
  const gameChoices = uniqueEntries([
    ...profile.currentPlayingEntries,
    ...profile.favoriteEntries,
    ...profile.shelfEntries,
  ])
    .filter((entry) => !latestPageByEntryId.has(entry.id))
    .slice(0, 12);
  const selectedPages = selectedEntry
    ? profile.user.journalEntries.filter(
        (entry) => entry.userGameEntryId === selectedEntry.id,
      )
    : [];

  return (
    <section className="panel bg-sky-soft/55">
      <SectionHeader
        eyebrow={t("journal.label")}
        title={t("journal.title")}
        description={t("journal.description")}
      />

      {selectedEntry ? (
        <div className="grid gap-6">
          <div className="grid gap-3">
            <Link
              className="inline-flex items-center gap-1.5 justify-self-start rounded-inner text-sm font-bold text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              href="/profile?tab=journal"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              {t("journal.backToList")}
            </Link>

            <div className="rounded-card border border-edge bg-surface p-5 shadow-rest max-sm:p-4">
              <div className="mb-5 grid gap-4">
                <Link
                  className="group flex min-w-0 items-center gap-4 justify-self-start rounded-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  href={`/games/${selectedEntry.game.slug}`}
                >
                  <span className="grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-inner border border-edge bg-canvas font-display text-lg">
                    {selectedEntry.game.coverUrl ? (
                      <Image
                        alt=""
                        className="h-full w-full object-cover"
                        height={112}
                        src={selectedEntry.game.coverUrl}
                        width={112}
                      />
                    ) : (
                      selectedEntry.game.name.slice(0, 1)
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="section-label !mb-1 block">
                      {t("journal.writingFor")}
                    </span>
                    <span className="block truncate font-display text-2xl font-medium underline-offset-4 group-hover:underline">
                      {selectedEntry.game.name}
                    </span>
                  </span>
                </Link>
              </div>

            <JournalForm action={createJournalEntryAction} userId={profile.user.id}>
              <input
                name="userGameEntryId"
                type="hidden"
                value={selectedEntry.id}
              />
              <input
                name="returnTo"
                type="hidden"
                value={`${buildEntryHref(selectedEntry.id)}&journal=saved`}
              />

              <JournalComposer
                maxRecordingSeconds={aiSettings.voiceRecordingMaxSeconds}
              />
              </JournalForm>
            </div>
          </div>

          <div className="grid gap-4">
            <h3 className="font-display text-xl font-medium">
              {t("journal.pagesFor", { name: selectedEntry.game.name })}
            </h3>
            {selectedPages.length ? (
              selectedPages.map((entry) => (
                <JournalPageCard entry={entry} key={entry.id} locale={locale} />
              ))
            ) : (
              <EmptyState title={t("journal.noPagesTitle")}>
                {t("journal.noPagesBody")}
              </EmptyState>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {gamesWithPages.length ? (
            <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
              {gamesWithPages.map((page) => (
                <Link
                  className="flex min-w-0 items-center gap-3 rounded-inner border border-edge bg-surface px-3 py-2 text-left text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  href={buildEntryHref(page.userGameEntryId)}
                  key={page.userGameEntryId}
                >
                  <span className="grid h-12 w-12 flex-none place-items-center overflow-hidden rounded-[8px] border border-edge bg-canvas text-sm font-bold">
                    {page.game.coverUrl ? (
                      <Image
                        alt=""
                        className="h-full w-full object-cover"
                        height={96}
                        src={page.game.coverUrl}
                        width={96}
                      />
                    ) : (
                      page.game.name.slice(0, 1)
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {page.game.name}
                    </span>
                    <span className="block truncate text-xs font-semibold text-ink-soft">
                      {t("journal.lastPageOn", {
                        date: formatDate(page.occurredAt),
                      })}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 flex-none text-ink-soft"
                  />
                </Link>
              ))}
            </div>
          ) : null}

          {!gamesWithPages.length && gameChoices.length ? (
            <EmptyState title={t("journal.emptyIndexTitle")}>
              {t("journal.emptyIndexBody")}
            </EmptyState>
          ) : null}

          {gameChoices.length ? (
            gamesWithPages.length ? (
              <details className="group/start">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-bold text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas [&::-webkit-details-marker]:hidden">
                  {t("journal.startForAnotherGame")}
                  <ChevronDown
                    aria-hidden="true"
                    className="h-4 w-4 motion-safe:transition-transform group-open/start:rotate-180"
                  />
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-2 max-md:grid-cols-1">
                  {gameChoices.map((entry) => (
                    <GameChoice entry={entry} isActive={false} key={entry.id} />
                  ))}
                </div>
              </details>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
                {gameChoices.map((entry) => (
                  <GameChoice entry={entry} isActive={false} key={entry.id} />
                ))}
              </div>
            )
          ) : null}

          {!gamesWithPages.length && !gameChoices.length ? (
            <EmptyState title={t("journal.noGamesTitle")}>
              {t("journal.noGamesBody")}
            </EmptyState>
          ) : null}
        </div>
      )}
    </section>
  );
}

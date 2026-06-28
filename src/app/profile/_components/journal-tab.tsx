import Image from "next/image";
import Link from "next/link";
import { BookOpen, ChevronRight, Mic, PenLine, Trash2 } from "lucide-react";
import {
  createJournalEntryAction,
  deleteJournalEntryAction,
} from "../actions";
import { VoiceMemoryInput } from "@/components/voice-memory-input";
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
    <article className="rounded-card border border-edge bg-surface p-5 shadow-rest">
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
            {entry.translatedTranscript ?? entry.audioTranscript}
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
  const selectedEntry =
    profile.user.gameEntries.find((entry) => entry.id === activeEntryId) ??
    profile.currentPlayingEntries[0] ??
    profile.favoriteEntries[0] ??
    profile.shelfEntries[0] ??
    null;
  const gameChoices = uniqueEntries([
    selectedEntry,
    ...profile.currentPlayingEntries,
    ...profile.favoriteEntries,
    ...profile.shelfEntries,
  ]).slice(0, 12);
  const selectedPages = selectedEntry
    ? profile.user.journalEntries.filter(
        (entry) => entry.userGameEntryId === selectedEntry.id,
      )
    : [];
  const recentPages = profile.user.journalEntries.slice(0, 5);

  return (
    <section className="panel bg-sky-soft/55">
      <SectionHeader
        eyebrow={t("journal.label")}
        title={t("journal.title")}
        description={t("journal.description")}
        aside={
          selectedEntry ? (
            <Button asChild variant="ghost">
              <Link href={`/games/${selectedEntry.game.slug}`}>
                {t("journal.openGame")}
                <ChevronRight />
              </Link>
            </Button>
          ) : null
        }
      />

      {selectedEntry ? (
        <div className="grid gap-6">
          <div className="rounded-card border border-edge bg-surface p-5 shadow-rest">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-inner border border-edge bg-canvas font-display text-lg">
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
                </div>
                <div className="min-w-0">
                  <p className="section-label !mb-1">{t("journal.writingFor")}</p>
                  <h3 className="truncate font-display text-2xl font-medium">
                    {selectedEntry.game.name}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-pill border border-edge bg-canvas px-3 py-2 text-sm font-bold text-ink-soft">
                <BookOpen className="h-4 w-4" />
                {t("journal.savedCount", { count: selectedPages.length })}
              </div>
            </div>

            <form action={createJournalEntryAction} className="grid gap-5">
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
              <input name="targetLanguage" type="hidden" value={locale === "pt-BR" ? "Portuguese (Brazil)" : "English"} />

              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-soft">
                  <Mic className="h-4 w-4" />
                  {t("journal.startWithVoice")}
                </div>
                <VoiceMemoryInput
                  maxRecordingSeconds={aiSettings.voiceRecordingMaxSeconds}
                />
              </div>

              <details className="rounded-inner border border-edge bg-canvas/70 p-4">
                <summary className="cursor-pointer text-sm font-bold text-ink transition-colors hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                  {t("journal.writeOrAddMore")}
                </summary>
                <div className="mt-4 grid gap-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-3 max-md:grid-cols-1">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold">{t("journal.pageTitle")}</span>
                      <input
                        autoComplete="off"
                        className="min-h-11 rounded-inner border border-edge bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                        name="title"
                        placeholder={t("journal.pageTitlePlaceholder")}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold">{t("journal.playedAround")}</span>
                      <input
                        autoComplete="off"
                        className="min-h-11 rounded-inner border border-edge bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                        name="occurredAt"
                        type="datetime-local"
                      />
                    </label>
                  </div>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">{t("journal.dearDiary")}</span>
                    <textarea
                      autoComplete="off"
                      className="min-h-44 rounded-inner border border-edge bg-surface px-3 py-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      name="body"
                      placeholder={t("journal.bodyPlaceholder")}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold">{t("journal.screenshot")}</span>
                      <input
                        accept="image/*"
                        className="w-full text-sm file:mr-3 file:cursor-pointer file:rounded-pill file:border file:border-edge file:bg-sage-soft file:px-4 file:py-2 file:font-semibold file:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                        name="image"
                        type="file"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold">
                        {t("journal.keepsakeCaption")}
                      </span>
                      <input
                        autoComplete="off"
                        className="min-h-11 rounded-inner border border-edge bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                        name="mediaCaption"
                        placeholder={t("journal.keepsakePlaceholder")}
                      />
                    </label>
                  </div>
                </div>
              </details>

              <Button className="justify-self-start" type="submit">
                <PenLine />
                {t("journal.savePage")}
              </Button>
            </form>
          </div>

          {gameChoices.length > 1 ? (
            <details className="rounded-card border border-edge bg-surface p-4 shadow-rest">
              <summary className="cursor-pointer text-sm font-bold text-ink transition-colors hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                {t("journal.chooseAnotherGame")}
              </summary>
              <div className="mt-4 grid grid-cols-2 gap-2 max-md:grid-cols-1">
                {gameChoices.map((entry) => (
                  <GameChoice
                    entry={entry}
                    isActive={entry.id === selectedEntry.id}
                    key={entry.id}
                  />
                ))}
              </div>
            </details>
          ) : null}

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
        <EmptyState title={t("journal.noGamesTitle")}>
          {t("journal.noGamesBody")}
        </EmptyState>
      )}

      {recentPages.length > 0 && selectedPages.length === 0 ? (
        <div className="mt-8 grid gap-4">
          <h3 className="font-display text-xl font-medium">
            {t("journal.recentPages")}
          </h3>
          {recentPages.map((entry) => (
            <JournalPageCard entry={entry} key={entry.id} locale={locale} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

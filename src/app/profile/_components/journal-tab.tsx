import Link from "next/link";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  PenLine,
  Search,
  Trash2,
} from "lucide-react";
import { deleteJournalEntryAction } from "../actions";
import { saveJournalPageAction } from "../journal-actions";
import { JournalComposer } from "./journal-composer";
import { JournalForm } from "./journal-form";
import { GameCard } from "@/components/game-card";
import { SafeImage } from "@/components/safe-image";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import type { AiSettingsValues } from "@/lib/ai-settings";
import { createTranslator, type Locale } from "@/lib/i18n";
import { matchesJournalSearch } from "@/lib/journal-search";
import type { ProfileData } from "./profile-types";

type JournalEntry = ProfileData["user"]["journalEntries"][number];

function buildEntryHref(entryId: string) {
  return `/profile?tab=journal&entryId=${encodeURIComponent(entryId)}`;
}

function dateLabel(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function JournalSearch({
  entryId,
  queryText,
  locale,
}: {
  entryId?: string;
  queryText: string;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  return (
    <form
      action="/profile"
      className="flex flex-wrap items-end gap-2"
      role="search"
    >
      <input name="tab" type="hidden" value="journal" />
      {entryId ? <input name="entryId" type="hidden" value={entryId} /> : null}
      <label className="grid min-w-0 flex-1 basis-56 gap-2">
        <span className="text-sm font-semibold">
          {t(entryId ? "journal.searchPages" : "journal.searchLibrary")}
        </span>
        <input
          className="min-h-11 min-w-0 rounded-inner border border-edge bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          defaultValue={queryText}
          key={queryText}
          name="q"
          placeholder={t(
            entryId
              ? "journal.searchPagesPlaceholder"
              : "journal.searchLibraryPlaceholder",
          )}
          type="search"
        />
      </label>
      <Button type="submit" variant="secondary">
        <Search aria-hidden="true" />
        {t("journal.search")}
      </Button>
      {queryText ? (
        <Button asChild variant="ghost">
          <Link
            href={entryId ? buildEntryHref(entryId) : "/profile?tab=journal"}
          >
            {t("journal.clearSearch")}
          </Link>
        </Button>
      ) : null}
    </form>
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
    <article
      className="min-w-0 rounded-card border border-edge bg-surface p-6 shadow-rest max-sm:p-4"
      id={`page-${entry.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-label !mb-2">
            <time dateTime={entry.occurredAt.toISOString()}>
              {dateLabel(entry.occurredAt, locale)}
            </time>
          </p>
          <h3 className="break-words font-display text-2xl font-medium">
            {entry.title ?? t("journal.untitledPage")}
          </h3>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link
            href={`${buildEntryHref(entry.userGameEntryId)}&editPageId=${encodeURIComponent(entry.id)}`}
          >
            <PenLine aria-hidden="true" />
            {t("journal.editPage")}
          </Link>
        </Button>
      </div>
      {entry.body ? (
        <p className="mt-5 max-w-[65ch] whitespace-pre-line break-words text-base leading-8 text-ink/90">
          {entry.body}
        </p>
      ) : null}
      {entry.media.length ? (
        <div className="mt-5 grid min-w-0 gap-4">
          {entry.media.map((media) =>
            media.kind === "image" ? (
              <figure
                className="overflow-hidden rounded-inner border border-edge bg-canvas"
                key={media.id}
              >
                <SafeImage
                  alt={
                    media.caption ??
                    t("journal.imageFor", { name: entry.game.name })
                  }
                  className="max-h-[36rem] w-full object-contain"
                  height={720}
                  loading="lazy"
                  src={media.url}
                  unoptimized
                  width={1280}
                />
                {media.caption ? (
                  <figcaption className="p-3 text-sm text-ink-soft">
                    {media.caption}
                  </figcaption>
                ) : null}
              </figure>
            ) : (
              <div
                className="min-w-0 rounded-inner border border-edge bg-canvas p-3"
                key={media.id}
              >
                <audio
                  aria-label={t("voiceMemory.playback")}
                  className="w-full min-w-0"
                  controls
                  preload="metadata"
                  src={media.url}
                />
                {media.caption ? (
                  <p className="mt-2 break-words text-xs text-ink-soft">
                    {media.caption}
                  </p>
                ) : null}
              </div>
            ),
          )}
        </div>
      ) : null}
      {entry.audioTranscript ? (
        <details className="mt-5 rounded-inner border border-edge bg-canvas/70 p-4">
          <summary className="cursor-pointer rounded text-sm font-semibold text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {t("journal.readTranscript")}
          </summary>
          <p className="mt-3 max-w-[65ch] whitespace-pre-line break-words text-sm leading-7 text-ink-soft">
            {entry.audioTranscript}
          </p>
        </details>
      ) : null}
      <details className="mt-5 border-t border-edge pt-3">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded text-xs font-semibold text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          {t("journal.deletePage")}
        </summary>
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-inner border border-edge bg-canvas/70 p-3">
          <p className="min-w-0 flex-1 text-sm text-ink-soft">
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
  mode = "read",
  editPageId,
  queryText = "",
}: {
  activeEntryId: string | null;
  aiSettings: AiSettingsValues;
  locale: Locale;
  profile: ProfileData;
  mode?: "read" | "write";
  editPageId?: string;
  queryText?: string;
}) {
  const t = createTranslator(locale);
  const selectedEntry = profile.user.gameEntries.find(
    (entry) => entry.id === activeEntryId,
  );
  const pagesByEntry = new Map<string, JournalEntry[]>();
  for (const page of profile.user.journalEntries) {
    const pages = pagesByEntry.get(page.userGameEntryId) ?? [];
    pages.push(page);
    pagesByEntry.set(page.userGameEntryId, pages);
  }
  const selectedPages = selectedEntry
    ? (pagesByEntry.get(selectedEntry.id) ?? [])
    : [];
  const editingPage = selectedPages.find((page) => page.id === editPageId);
  const writing = mode === "write" || Boolean(editingPage);
  const visiblePages = selectedPages.filter((page) =>
    matchesJournalSearch(
      queryText,
      selectedEntry?.game.name,
      page.title,
      page.body,
      page.audioTranscript,
    ),
  );
  const visibleGames = profile.user.gameEntries.filter(
    (entry) =>
      matchesJournalSearch(queryText, entry.game.name) ||
      (pagesByEntry.get(entry.id) ?? []).some((page) =>
        matchesJournalSearch(
          queryText,
          entry.game.name,
          page.title,
          page.body,
          page.audioTranscript,
        ),
      ),
  );
  const gamesWithPages = visibleGames
    .filter((entry) => pagesByEntry.has(entry.id))
    .sort(
      (a, b) =>
        pagesByEntry.get(b.id)![0].occurredAt.getTime() -
        pagesByEntry.get(a.id)![0].occurredAt.getTime(),
    );
  const otherGames = visibleGames.filter(
    (entry) => !pagesByEntry.has(entry.id),
  );
  const draftKey = selectedEntry
    ? `filazo:journal:${profile.user.id}:${selectedEntry.id}:${editingPage?.id ?? "new"}`
    : "";
  return (
    <section className="panel min-w-0 bg-sky-soft/55">
      <SectionHeader
        eyebrow={t("journal.label")}
        title={t("journal.title")}
        description={t("journal.description")}
      />
      {selectedEntry ? (
        <div className="grid min-w-0 gap-6">
          <Link
            className="inline-flex items-center gap-1.5 justify-self-start rounded text-sm font-bold text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/profile?tab=journal"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            {t("journal.backToList")}
          </Link>
          <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[13rem_minmax(0,1fr)]">
            <aside className="flex min-w-0 items-center gap-4 xl:sticky xl:top-24 xl:grid">
              <div className="grid aspect-[3/4] w-20 flex-none place-items-center overflow-hidden rounded-inner border border-edge bg-canvas text-2xl xl:w-full">
                {selectedEntry.game.coverUrl ? (
                  <SafeImage
                    alt=""
                    className="h-full w-full object-cover"
                    fallback={selectedEntry.game.name.slice(0, 1)}
                    height={320}
                    src={selectedEntry.game.coverUrl}
                    width={240}
                  />
                ) : (
                  selectedEntry.game.name.slice(0, 1)
                )}
              </div>
              <div className="min-w-0">
                <h2 className="break-words font-display text-2xl font-medium">
                  {selectedEntry.game.name}
                </h2>
                <Link
                  className="mt-2 inline-flex items-center gap-1 rounded text-sm text-ink-soft hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={`/games/${selectedEntry.game.slug}`}
                >
                  {t("journal.openGame")}
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            </aside>
            <div className="grid min-w-0 gap-5">
              <nav
                aria-label={t("journal.label")}
                className="flex flex-wrap gap-2 border-b border-edge pb-4"
              >
                <Button asChild variant={!writing ? "default" : "ghost"}>
                  <Link
                    aria-current={!writing ? "page" : undefined}
                    href={buildEntryHref(selectedEntry.id)}
                  >
                    <BookOpen aria-hidden="true" />
                    {t("journal.readPages")}
                  </Link>
                </Button>
                <Button
                  asChild
                  variant={writing && !editingPage ? "default" : "ghost"}
                >
                  <Link
                    aria-current={writing && !editingPage ? "page" : undefined}
                    href={`${buildEntryHref(selectedEntry.id)}&journalMode=write`}
                  >
                    <PenLine aria-hidden="true" />
                    {t("journal.newMemory")}
                  </Link>
                </Button>
              </nav>
              {writing ? (
                <div className="min-w-0 rounded-card border border-edge bg-surface p-5 max-sm:p-3">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-xl">
                      {t(
                        editingPage ? "journal.editPage" : "journal.newMemory",
                      )}
                    </h3>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={buildEntryHref(selectedEntry.id)}>
                        {t("journal.backToReading")}
                      </Link>
                    </Button>
                  </div>
                  <JournalForm
                    action={saveJournalPageAction}
                    draftKey={draftKey}
                    key={draftKey}
                    successHref={`${buildEntryHref(selectedEntry.id)}&journal=saved`}
                    userId={profile.user.id}
                  >
                    <input
                      name="userGameEntryId"
                      type="hidden"
                      value={selectedEntry.id}
                    />
                    {editingPage ? (
                      <input
                        name="journalEntryId"
                        type="hidden"
                        value={editingPage.id}
                      />
                    ) : null}
                    <JournalComposer
                      draftKey={draftKey}
                      initial={
                        editingPage
                          ? {
                              title: editingPage.title ?? "",
                              body: editingPage.body ?? "",
                              occurredAt: editingPage.occurredAt.toISOString(),
                            }
                          : undefined
                      }
                      maxRecordingSeconds={aiSettings.voiceRecordingMaxSeconds}
                    />
                  </JournalForm>
                </div>
              ) : (
                <>
                  {selectedPages.length ? (
                    <JournalSearch
                      entryId={selectedEntry.id}
                      locale={locale}
                      queryText={queryText}
                    />
                  ) : null}
                  {visiblePages.length ? (
                    visiblePages.map((page) => (
                      <JournalPageCard
                        entry={page}
                        key={page.id}
                        locale={locale}
                      />
                    ))
                  ) : (
                    <EmptyState
                      title={t(
                        queryText
                          ? "journal.noResults"
                          : "journal.noPagesTitle",
                      )}
                    >
                      {t(
                        queryText ? "journal.trySearch" : "journal.noPagesBody",
                      )}
                    </EmptyState>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {profile.user.gameEntries.length ? (
            <JournalSearch locale={locale} queryText={queryText} />
          ) : null}
          {gamesWithPages.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] items-start gap-4">
              {gamesWithPages.map((entry) => {
                const pages = pagesByEntry.get(entry.id)!;
                const searchingPages =
                  Boolean(queryText) &&
                  !matchesJournalSearch(queryText, entry.game.name);
                const page =
                  (searchingPages
                    ? pages.find((page) =>
                        matchesJournalSearch(
                          queryText,
                          entry.game.name,
                          page.title,
                          page.body,
                          page.audioTranscript,
                        ),
                      )
                    : null) ?? pages[0];
                return (
                  <GameCard
                    game={entry.game}
                    href={`${buildEntryHref(entry.id)}${searchingPages ? `&q=${encodeURIComponent(queryText)}` : ""}`}
                    key={entry.id}
                    locale={locale}
                    variant="shelf"
                    footer={
                      <div className="grid gap-2 border-t border-edge pt-3">
                        <p className="text-xs text-ink-soft">
                          {t(
                            searchingPages
                              ? "journal.matchingPageOn"
                              : "journal.lastPageOn",
                            {
                              date: dateLabel(page.occurredAt, locale),
                            },
                          )}
                        </p>
                        {page.title ? (
                          <p className="line-clamp-2 text-sm font-semibold">
                            {page.title}
                          </p>
                        ) : null}
                        <p className="line-clamp-3 text-sm leading-relaxed text-ink-soft">
                          {page.body ||
                            page.audioTranscript ||
                            t("journal.keepsakes")}
                        </p>
                      </div>
                    }
                  />
                );
              })}
            </div>
          ) : null}
          {!visibleGames.length ? (
            <EmptyState
              title={t(
                queryText ? "journal.noResults" : "journal.noGamesTitle",
              )}
            >
              {t(queryText ? "journal.trySearch" : "journal.noGamesBody")}
            </EmptyState>
          ) : null}
          {!gamesWithPages.length && otherGames.length && !queryText ? (
            <EmptyState title={t("journal.emptyIndexTitle")}>
              {t("journal.emptyIndexBody")}
            </EmptyState>
          ) : null}
          {otherGames.length ? (
            <details
              className="rounded-inner border border-edge bg-canvas/40 p-4"
              open={Boolean(queryText) || !gamesWithPages.length}
            >
              <summary className="cursor-pointer rounded text-sm font-bold text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {t("journal.startForAnotherGame")}
              </summary>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                {otherGames.map((entry) => (
                  <Link
                    className="flex min-w-0 items-center justify-between gap-3 rounded-inner border border-edge bg-surface p-3 text-sm font-semibold hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={`${buildEntryHref(entry.id)}&journalMode=write`}
                    key={entry.id}
                  >
                    <span className="min-w-0 break-words">
                      {entry.game.name}
                    </span>
                    <PenLine
                      aria-hidden="true"
                      className="h-4 w-4 flex-none text-ink-soft"
                    />
                  </Link>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </section>
  );
}

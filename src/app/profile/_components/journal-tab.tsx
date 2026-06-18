import Image from "next/image";
import Link from "next/link";
import { BookOpen, ChevronRight, Mic, PenLine } from "lucide-react";
import { createJournalEntryAction } from "../actions";
import { VoiceMemoryInput } from "@/components/voice-memory-input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
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

function JournalPageCard({ entry }: { entry: JournalEntry }) {
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
            {entry.title ?? "Untitled Page"}
          </h3>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link href={`/games/${entry.game.slug}`}>
            View Game
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
          <p className="section-label !mb-2">Voice Memory</p>
          <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink-soft">
            {entry.translatedTranscript ?? entry.audioTranscript}
          </p>
        </div>
      ) : null}

      {entry.media.length ? (
        <div className="mt-4 grid gap-3">
          <p className="section-label !mb-0">Keepsakes</p>
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
    </article>
  );
}

export function JournalTab({
  activeEntryId,
  profile,
}: {
  activeEntryId: string | null;
  profile: ProfileData;
}) {
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
        eyebrow="Journal"
        title="Diary Pages"
        description="Record the moment first. Writing, screenshots, and uploads stay tucked away as backup options."
        aside={
          selectedEntry ? (
            <Button asChild variant="ghost">
              <Link href={`/games/${selectedEntry.game.slug}`}>
                Open Game
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
                  <p className="section-label !mb-1">Writing For</p>
                  <h3 className="truncate font-display text-2xl font-medium">
                    {selectedEntry.game.name}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-pill border border-edge bg-canvas px-3 py-2 text-sm font-bold text-ink-soft">
                <BookOpen className="h-4 w-4" />
                {selectedPages.length} saved
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
              <input name="targetLanguage" type="hidden" value="English" />

              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-soft">
                  <Mic className="h-4 w-4" />
                  Start With Your Voice
                </div>
                <VoiceMemoryInput />
              </div>

              <details className="rounded-inner border border-edge bg-canvas/70 p-4">
                <summary className="cursor-pointer text-sm font-bold text-ink transition-colors hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                  Write Instead Or Add More
                </summary>
                <div className="mt-4 grid gap-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-3 max-md:grid-cols-1">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold">Page Title</span>
                      <input
                        autoComplete="off"
                        className="min-h-11 rounded-inner border border-edge bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                        name="title"
                        placeholder="Before the next session"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold">Played Around</span>
                      <input
                        autoComplete="off"
                        className="min-h-11 rounded-inner border border-edge bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                        name="occurredAt"
                        type="datetime-local"
                      />
                    </label>
                  </div>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Dear Diary</span>
                    <textarea
                      autoComplete="off"
                      className="min-h-44 rounded-inner border border-edge bg-surface px-3 py-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      name="body"
                      placeholder="I stopped at... I want to remember... Next time I should try..."
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold">Screenshot</span>
                      <input
                        accept="image/*"
                        className="w-full text-sm file:mr-3 file:cursor-pointer file:rounded-pill file:border file:border-edge file:bg-sage-soft file:px-4 file:py-2 file:font-semibold file:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                        name="image"
                        type="file"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold">
                        Keepsake Caption
                      </span>
                      <input
                        autoComplete="off"
                        className="min-h-11 rounded-inner border border-edge bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                        name="mediaCaption"
                        placeholder="What this memory shows"
                      />
                    </label>
                  </div>
                </div>
              </details>

              <Button className="justify-self-start" type="submit">
                <PenLine />
                Save Diary Page
              </Button>
            </form>
          </div>

          {gameChoices.length > 1 ? (
            <details className="rounded-card border border-edge bg-surface p-4 shadow-rest">
              <summary className="cursor-pointer text-sm font-bold text-ink transition-colors hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                Choose Another Game
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
              Pages For {selectedEntry.game.name}
            </h3>
            {selectedPages.length ? (
              selectedPages.map((entry) => (
                <JournalPageCard entry={entry} key={entry.id} />
              ))
            ) : (
              <EmptyState title="No pages for this game yet.">
                A short voice note is enough to remember where you left off.
              </EmptyState>
            )}
          </div>
        </div>
      ) : (
        <EmptyState title="No games available for journaling yet.">
          Add a game to your catalog first, then come back here to keep diary
          pages.
        </EmptyState>
      )}

      {recentPages.length > 0 && selectedPages.length === 0 ? (
        <div className="mt-8 grid gap-4">
          <h3 className="font-display text-xl font-medium">
            Recent Diary Pages
          </h3>
          {recentPages.map((entry) => (
            <JournalPageCard entry={entry} key={entry.id} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

import Link from "next/link";
import { AssistantSignalType } from "@prisma/client";
import { Armchair, LibraryBig, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { BacklogDiagnosis } from "@/components/assistant/backlog-diagnosis";
import { BuyDecisionForm } from "@/components/assistant/buy-decision-form";
import { LibraryChat } from "@/components/assistant/library-chat";
import { PlayNextPanel } from "@/components/assistant/play-next-panel";
import { PlayerProfilePanel } from "@/components/assistant/player-profile-panel";
import { CsvImportWidget } from "@/components/csv-import-widget";
import { GameCard } from "@/components/game-card";
import { SyncActionForm } from "@/components/sync-action-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { SectionHeader } from "@/components/ui/section-header";
import { getProfileData } from "@/lib/catalog";
import { getAssistantSignalDisplayLabel } from "@/lib/copy";
import { getDatabaseErrorMessage } from "@/lib/database-errors";
import {
  getAssistantProfileData,
  getAssistantSignalEntryIds,
} from "@/lib/assistant/queries";
import { getPlayerProfileForUser } from "@/lib/assistant/profile-agent";
import { hasIgdbConfig } from "@/lib/igdb";
import {
  parseProfileGameSort,
  sortProfileGameEntries,
} from "@/lib/profile-games";
import { getSessionUserId } from "@/lib/session";
import { isSteamConfigured } from "@/lib/steam";
import { isXboxConfigured } from "@/lib/xbox";
import {
  cn,
  formatDate,
  formatNumber,
} from "@/lib/utils";
import {
  generatePlayerProfileAction,
  refreshAssistantInsightsAction,
} from "./assistant-actions";
import {
  connectPlayStationAction,
  detectFinishedGamesAction,
  importCsvAction,
  syncPlayStationLibraryAction,
  syncSteamLibraryAction,
  syncXboxLibraryAction,
  toggleFavoriteAction,
} from "./actions";

type ProfileSearchParams = Promise<{
  tab?: string;
  view?: string;
  sort?: string;
  signal?: string;
  connected?: string;
  synced?: string;
  imported?: string;
  playstation?: string;
  playstationSynced?: string;
  xbox?: string;
  xboxSynced?: string;
  assistant?: string;
  playerProfile?: string;
  finishedDetected?: string;
  finishedScanned?: string;
  error?: string;
}>;

function parseAssistantSignal(value: string | undefined) {
  return Object.values(AssistantSignalType).includes(value as AssistantSignalType)
    ? (value as AssistantSignalType)
    : null;
}

function formatAssistantCooldown(seconds: number) {
  if (seconds <= 0) {
    return "available now";
  }

  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "in 1 minute" : `in ${minutes} minutes`;
}

function HeartIcon({ filled, className }: { filled: boolean; className?: string }) {
  return filled ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

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

export default async function ProfilePage({
  searchParams,
}: PageProps<"/profile"> & { searchParams: ProfileSearchParams }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return (
      <main id="main-content" className="mx-auto w-full max-w-[760px]">
        <section className="panel p-10 text-center">
          <p className="section-label justify-center">Your library</p>
          <h1 className="mb-3 text-page-title leading-snug">
            Connect an account to begin.
          </h1>
          <p className="mx-auto max-w-[42ch] leading-relaxed text-ink-soft">
            Link Steam or Xbox to bring your games here. CSV and PlayStation
            imports are waiting too — start wherever feels easiest.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Button asChild>
              <a href="/api/auth/steam">Connect Steam</a>
            </Button>
            {isXboxConfigured() ? (
              <Button asChild variant="ghost">
                <a href="/api/auth/xbox">Connect Xbox</a>
              </Button>
            ) : null}
            <Button asChild variant="ghost">
              <Link href="/">Back home</Link>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  let profile: Awaited<ReturnType<typeof getProfileData>>;
  try {
    profile = await getProfileData(userId);
  } catch (error) {
    console.error("Could not load profile data.", error);

    return (
      <main id="main-content" className="mx-auto w-full max-w-[760px]">
        <section className="panel bg-clay-soft p-10 text-center">
          <p className="section-label justify-center">Database unavailable</p>
          <h1 className="mb-3 text-[clamp(1.6rem,4vw,2.4rem)] leading-snug">
            Your library can&apos;t load right now.
          </h1>
          <p className="mx-auto max-w-[44ch] leading-relaxed text-ink-soft">
            {getDatabaseErrorMessage(error)} Vercel deployments need a
            production database connection; this repo&apos;s SQLite file setup is
            intended for local development.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Button asChild>
              <Link href="/">Back home</Link>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  if (!profile) {
    redirect("/");
  }

  const query = await searchParams;
  const activeTab =
    query.tab === "games"
      ? "games"
      : query.tab === "assistant" || query.tab === "coach"
        ? "assistant"
        : "overview";
  const assistant =
    activeTab === "assistant" ? await getAssistantProfileData(userId) : null;
  const playerProfile =
    activeTab === "overview" ? await getPlayerProfileForUser(userId) : null;
  const activeSignal = parseAssistantSignal(query.signal);
  const signalEntryIds =
    activeTab === "games" && activeSignal
      ? await getAssistantSignalEntryIds(userId, activeSignal)
      : null;
  const gamesView = query.view === "grid" ? "grid" : "list";
  const gamesSort = parseProfileGameSort(query.sort);
  const gameEntries = sortProfileGameEntries(
    [...profile.ownedEntries, ...profile.wishlistEntries].filter((entry) =>
      signalEntryIds ? signalEntryIds.has(entry.id) : true,
    ),
    gamesSort,
  );

  const statusMessage = query.error
    ? { tone: "error" as const, message: query.error }
    : query.synced
      ? {
          tone: "success" as const,
          message: `Steam sync finished. ${query.synced} titles refreshed.`,
        }
      : query.playstationSynced
        ? {
            tone: "success" as const,
            message: `PlayStation sync finished. ${query.playstationSynced} played titles refreshed.`,
          }
      : query.xboxSynced
        ? {
            tone: "success" as const,
            message: `Xbox sync finished. ${query.xboxSynced} achievement-history titles refreshed.`,
          }
      : query.finishedDetected
        ? {
            tone: "success" as const,
            message: `Credits-rolled detection checked ${
              query.finishedScanned ?? "your"
            } entries and found ${query.finishedDetected} with credits rolled.`,
          }
      : query.imported
        ? {
            tone: "success" as const,
            message: `CSV import finished. ${query.imported} rows were added or updated.`,
          }
        : query.connected
          ? {
              tone: "success" as const,
              message:
                "Steam account connected. Run a sync to pull the library.",
            }
          : query.playstation === "connected"
            ? {
                tone: "success" as const,
                message:
                  "PlayStation connected. Run a sync to pull played trophy titles.",
              }
          : query.xbox === "connected"
            ? {
                tone: "success" as const,
                message:
                  "Xbox connected. Run a sync to pull achievement-history titles.",
              }
          : query.assistant
            ? {
                tone: "success" as const,
                message: `Assistant refreshed. ${query.assistant} insights updated.`,
              }
            : query.playerProfile === "updated"
              ? {
                  tone: "success" as const,
                  message:
                    "Player profile generated from your games, feedback, and reviews.",
                }
              : query.playerProfile === "empty"
                ? {
                    tone: "error" as const,
                    message:
                      "Your shelf is quiet right now. Sync a platform or import a CSV before asking for a player profile.",
                  }
                : null;

  const gamesCount =
    profile.ownedEntries.length + profile.wishlistEntries.length;
  const railSections = [
    {
      tab: "overview",
      href: "/profile",
      label: "Overview",
      hint: "Profile & connections",
      icon: Armchair,
      count: null as number | null,
    },
    {
      tab: "games",
      href: "/profile?tab=games",
      label: "Games",
      hint: "Your whole shelf",
      icon: LibraryBig,
      count: gamesCount,
    },
    {
      tab: "assistant",
      href: "/profile?tab=assistant",
      label: "Assistant",
      hint: "Gentle suggestions",
      icon: Sparkles,
      count: assistant ? assistant.insights.length : null,
    },
  ];

  return (
    <main
      id="main-content"
      className="mx-auto grid w-full max-w-[1180px] grid-cols-[260px_minmax(0,1fr)] items-start gap-8 max-lg:grid-cols-1"
    >
      {/* ── Identity rail ── */}
      <aside className="sticky top-6 grid gap-4 self-start max-lg:static">
        <div className="relative overflow-hidden rounded-[28px] bg-dusk-deep p-6 text-cream">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-[200px] w-[200px] rounded-full bg-glow/25 blur-[70px] animate-breathe"
          />
          <div className="relative">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-cream/15 font-display text-2xl ring-2 ring-cream/20">
              {profile.user.avatarUrl ? (
                <img
                  alt={`${profile.user.displayName ?? "User"} avatar`}
                  src={profile.user.avatarUrl}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{(profile.user.displayName ?? "C").slice(0, 1)}</span>
              )}
            </div>
            <h1 className="mt-4 truncate font-display text-xl font-medium">
              {profile.user.displayName ?? "Player"}
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-cream/55">
              {formatNumber(profile.ownedEntries.length)} on the shelf ·{" "}
              {formatNumber(profile.wishlistEntries.length)} still curious ·{" "}
              {formatNumber(profile.user.externalAccounts.length)}{" "}
              {profile.user.externalAccounts.length === 1
                ? "account"
                : "accounts"}
            </p>
          </div>
        </div>

        <nav
          className="grid gap-1 rounded-[28px] border border-edge bg-surface p-2 shadow-rest"
          aria-label="Profile sections"
        >
          {railSections.map(({ tab, href, label, hint, icon: Icon, count }) => (
            <Link
              href={href}
              key={tab}
              aria-current={activeTab === tab ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[20px] px-4 py-3 transition-colors duration-200",
                activeTab === tab
                  ? "bg-ink text-surface"
                  : "text-ink-soft hover:bg-canvas hover:text-ink",
              )}
            >
              <Icon className="h-4.5 w-4.5 flex-none opacity-80" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold leading-tight">
                  {label}
                </span>
                <span
                  className={cn(
                    "block text-caption leading-tight",
                    activeTab === tab ? "text-surface/60" : "text-ink-soft/70",
                  )}
                >
                  {hint}
                </span>
              </span>
              {count !== null ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[0.68rem] font-bold",
                    activeTab === tab
                      ? "bg-surface/20 text-surface"
                      : "bg-canvas text-ink-soft",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <p className="px-4 text-center font-display text-sm italic text-ink-soft/80 max-lg:hidden">
          your shelf, your pace
        </p>
      </aside>

      {/* ── Content column ── */}
      <div className="grid min-w-0 gap-7">
      {/* ── Status Banner ── */}
      {statusMessage ? (
        <Notice tone={statusMessage.tone}>{statusMessage.message}</Notice>
      ) : null}

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" ? (
        <>
          <PlayerProfilePanel
            action={generatePlayerProfileAction}
            aiConfigured={Boolean(process.env.OPENAI_API_KEY)}
            hasGames={
              profile.ownedEntries.length + profile.wishlistEntries.length > 0
            }
            profile={playerProfile}
          />

          {/* Favorite Games */}
          <section className="panel">
            <SectionHeader
              eyebrow="Favorites"
              title="Games you love"
              aside={
                <div className="pill">
                  {profile.favoriteEntries.length} favorited
                </div>
              }
            />

            {profile.favoriteEntries.length ? (
              <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
                {profile.favoriteEntries.map((entry) => (
                  <div className="grid gap-2" key={`fav-${entry.id}`}>
                    <GameCard
                      game={entry.game}
                      platformName={entry.platformName}
                      playtimeMinutes={entry.playtimeMinutes}
                      completionPercent={entry.completionPercent}
                      status={
                        entry.finishedAt && entry.status !== "COMPLETED"
                          ? "FINISHED"
                          : entry.status
                      }
                      variant="shelf"
                    />
                    <form action={toggleFavoriteAction}>
                      <input type="hidden" name="entryId" value={entry.id} />
                      <button
                        type="submit"
                        className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-pill border border-edge bg-surface px-3 py-2 text-xs font-bold text-clay shadow-rest transition-colors hover:bg-clay-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                        aria-label={`Remove ${entry.game.name} from favorites`}
                        title="Remove from favorites"
                      >
                        <HeartIcon filled className="h-4 w-4" />
                        Favorite
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No favorites yet — and that's fine.">
                Tap the heart on any game whenever one feels special.
              </EmptyState>
            )}
          </section>

          {/* Connections + import panels */}
          <section className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
            <article className="panel">
              <SectionHeader
                eyebrow="Steam"
                title="Account and sync"
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
                <ConnectionRow label="Steam profile">
                  {profile.steamAccount?.profileUrl ? (
                    <a
                      href={profile.steamAccount.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="nav-link"
                    >
                      Open profile
                    </a>
                  ) : (
                    "Unavailable"
                  )}
                </ConnectionRow>
                <ConnectionRow label="Config">
                  Steam API {isSteamConfigured() ? "ready" : "missing key"} ·
                  IGDB {hasIgdbConfig() ? "ready" : "missing keys"}
                </ConnectionRow>
              </div>
            </article>

            <article className="panel">
              <SectionHeader
                eyebrow="Xbox"
                title="Achievement sync"
                aside={
                  profile.xboxAccount ? (
                    <SyncActionForm
                      action={syncXboxLibraryAction}
                      buttonLabel="Sync Xbox"
                      pendingLabel="Syncing Xbox..."
                      pendingNotice="Xbox sync is running. Keep this page open while achievement-history titles are attached to your catalog."
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
                {profile.xboxAccount?.profileUrl ? (
                  <ConnectionRow label="Profile">
                    <a
                      href={profile.xboxAccount.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="nav-link"
                    >
                      Open profile
                    </a>
                  </ConnectionRow>
                ) : null}
                <ConnectionRow label="Config">
                  OAuth {isXboxConfigured() ? "ready" : "missing client ID"}
                </ConnectionRow>
                <p className="text-sm leading-relaxed text-ink-soft">
                  Xbox sync imports titles found through achievement and recent
                  title history. It may miss owned games without achievement
                  activity.
                </p>
                {!profile.xboxAccount && !isXboxConfigured() ? (
                  <p className="text-xs leading-relaxed text-ink-soft">
                    Set XBOX_CLIENT_ID and XBOX_CLIENT_SECRET to enable
                    Microsoft account sign-in.
                  </p>
                ) : null}
              </div>
            </article>

            <article className="panel">
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
                {profile.playStationAccount?.profileUrl ? (
                  <ConnectionRow label="Profile">
                    <a
                      href={profile.playStationAccount.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="nav-link"
                    >
                      Open profile
                    </a>
                  </ConnectionRow>
                ) : null}
                {profile.playStationAccount ? (
                  <p className="text-sm leading-relaxed text-ink-soft">
                    Sync imports PS4/PS5 purchased games and fills in trophy
                    progress for titles that appear on your trophy list.
                  </p>
                ) : (
                  <form action={connectPlayStationAction} className="grid gap-4">
                    <div className="grid gap-3 border-y border-edge py-3.5">
                      <p className="text-sm font-semibold leading-relaxed">
                        This sync imports PS4/PS5 purchased games and titles
                        from your trophy list, then attaches them to the
                        catalog.
                      </p>
                      <ol className="grid gap-2.5 text-sm leading-relaxed text-ink-soft">
                        <li>
                          <strong>1.</strong>{" "}
                          <a
                            className="nav-link"
                            href="https://my.playstation.com/"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Sign in to PlayStation
                          </a>{" "}
                          in this browser.
                        </li>
                        <li>
                          <strong>2.</strong>{" "}
                          <a
                            className="nav-link"
                            href="https://ca.account.sony.com/api/v1/ssocookie"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open the NPSSO page
                          </a>{" "}
                          after sign-in.
                        </li>
                        <li>
                          <strong>3.</strong> Copy only the value inside{" "}
                          <code className="rounded-[6px] bg-canvas px-1.5 py-0.5 font-mono text-[0.8em]">
                            npsso
                          </code>
                          , paste it below, then connect.
                        </li>
                      </ol>
                      <p className="text-xs leading-relaxed text-ink-soft">
                        Treat NPSSO like a temporary login secret. filazo
                        exchanges it for PlayStation API tokens and does not
                        store the NPSSO itself.
                      </p>
                    </div>
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
                    <Button type="submit">
                      Connect PlayStation
                    </Button>
                  </form>
                )}
              </div>
            </article>

            <article className="panel">
              <SectionHeader
                eyebrow="CSV imports"
                title="Bring in library exports"
                aside={
                  <div className="pill">
                    {profile.latestImport
                      ? `Latest: ${formatDate(profile.latestImport.createdAt)}`
                      : "No imports yet"}
                  </div>
                }
              />
              <CsvImportWidget action={importCsvAction} />
            </article>
          </section>
        </>
      ) : null}

      {/* ── ASSISTANT TAB ── */}
      {activeTab === "assistant" && assistant ? (
        <>
          <section className="flex items-center justify-between gap-4 rounded-card border border-edge bg-dusk-lavender-soft px-6 py-5 shadow-rest max-md:flex-col max-md:items-start">
            <div>
              <p className="section-label !mb-1">Shelf companion</p>
              <p className="text-sm font-semibold leading-snug">
                Refresh insights after syncs, imports, or status changes.
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                AI explanations are optional — rule-based suggestions work
                without an API key.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-soft">
                <span className="rounded-full bg-surface px-3 py-1">
                  AI calls left today:{" "}
                  {formatNumber(assistant.aiUsage.effectiveRemainingToday)}
                </span>
                <span className="rounded-full bg-surface px-3 py-1">
                  Your use: {formatNumber(assistant.aiUsage.userUsedToday)} /{" "}
                  {formatNumber(assistant.aiUsage.userDailyLimit)}
                </span>
                <span className="rounded-full bg-surface px-3 py-1">
                  Next AI refresh:{" "}
                  {assistant.aiUsage.openAiConfigured
                    ? formatAssistantCooldown(
                        assistant.aiUsage.cooldownRemainingSeconds,
                      )
                    : "API key missing"}
                </span>
              </div>
            </div>
            <form action={refreshAssistantInsightsAction}>
              <Button type="submit">
                Refresh assistant
              </Button>
            </form>
          </section>

          <LibraryChat aiConfigured={Boolean(process.env.OPENAI_API_KEY)} />

          <BacklogDiagnosis assistant={assistant} />
          <PlayNextPanel assistant={assistant} />

          <section className="panel">
            <SectionHeader
              eyebrow="Thinking of buying?"
              title="Buy, wait, stay curious, or pass"
            />
            <BuyDecisionForm />
          </section>
        </>
      ) : null}

      {/* ── GAMES TAB ── */}
      {activeTab === "games" ? (
        <>
          {/* View toggle toolbar */}
          <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div>
              <p className="text-sm text-ink-soft">
                {gameEntries.length} games
                {activeSignal
                  ? ` matching ${getAssistantSignalDisplayLabel(activeSignal)}`
                  : ""}
              </p>
              {activeSignal ? (
                <Link
                  className="nav-link text-xs"
                  href="/profile?tab=games&view=list"
                >
                  Clear assistant filter
                </Link>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-pill border border-edge bg-surface p-1">
                {[
                  ["added", "Newest"],
                  ["playtime", "Playtime"],
                  ["title", "Title"],
                ].map(([sort, label]) => (
                  <Link
                    href={`/profile?tab=games&view=${gamesView}&sort=${sort}${
                      activeSignal ? `&signal=${activeSignal}` : ""
                    }`}
                    className={cn(
                      "rounded-pill px-3 py-1.5 text-xs font-bold transition-colors",
                      gamesSort === sort
                        ? "bg-ink text-surface"
                        : "text-ink-soft hover:bg-canvas hover:text-ink",
                    )}
                    key={sort}
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <div className="flex gap-1 rounded-pill border border-edge bg-surface p-1">
                <Link
                  href={`/profile?tab=games&view=list&sort=${gamesSort}${
                    activeSignal ? `&signal=${activeSignal}` : ""
                  }`}
                  className={cn(
                    "grid place-items-center rounded-pill px-3 py-1.5 transition-colors",
                    gamesView === "list"
                      ? "bg-ink text-surface"
                      : "text-ink-soft hover:bg-canvas hover:text-ink",
                  )}
                  aria-label="List view"
                  title="List view"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4.5 w-4.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
                  </svg>
                </Link>
                <Link
                  href={`/profile?tab=games&view=grid&sort=${gamesSort}${
                    activeSignal ? `&signal=${activeSignal}` : ""
                  }`}
                  className={cn(
                    "grid place-items-center rounded-pill px-3 py-1.5 transition-colors",
                    gamesView === "grid"
                      ? "bg-ink text-surface"
                      : "text-ink-soft hover:bg-canvas hover:text-ink",
                  )}
                  aria-label="Grid view"
                  title="Grid view"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4.5 w-4.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          <section className="flex items-center justify-between gap-4 rounded-card border border-edge bg-sand-soft px-6 py-5 shadow-rest max-md:flex-col max-md:items-start">
            <div>
              <p className="section-label !mb-1">Sync reminder</p>
              <p className="text-sm font-semibold leading-snug">
                Playtime, last played, and achievement progress refresh after a
                library sync.
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                Last sync:{" "}
                {profile.steamAccount?.lastSyncedAt
                  ? formatDate(profile.steamAccount.lastSyncedAt)
                  : "not synced yet"}
              </p>
            </div>
            {profile.steamAccount ? (
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
            )}
          </section>

          <section className="flex items-center justify-between gap-4 rounded-card border border-edge bg-dusk-lavender-soft px-6 py-5 shadow-rest max-md:flex-col max-md:items-start">
            <div>
              <p className="section-label !mb-1">Finished games</p>
              <p className="text-sm font-semibold leading-snug">
                A game is finished when the credits roll — not at 100%
                achievements.
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                Detection looks for each game&apos;s story
                achievement or trophy on Steam and PlayStation and marks the
                ones you already unlocked.
              </p>
            </div>
            {profile.steamAccount || profile.playStationAccount ? (
              <SyncActionForm
                action={detectFinishedGamesAction}
                buttonLabel="Check credits rolled"
                pendingLabel="Checking..."
                pendingNotice="Checking story achievements. Large libraries can take a few minutes; keep this page open."
              />
            ) : (
              <p className="text-xs font-semibold text-ink-soft">
                Connect Steam or PlayStation to use detection.
              </p>
            )}
          </section>

          {/* ── List View ── */}
          {gamesView === "list" ? (
            <section className="panel">
              {gameEntries.length ? (
                <div className="grid gap-3">
                  {gameEntries.map((entry) => (
                    <div
                      className="grid scroll-mt-6 grid-cols-[minmax(0,1fr)_44px] items-center gap-3 target:rounded-card target:ring-2 target:ring-sky"
                      id={`entry-${entry.id}`}
                      key={`list-${entry.id}`}
                    >
                      <GameCard
                        game={entry.game}
                        platformName={entry.platformName}
                        playtimeMinutes={entry.playtimeMinutes}
                        completionPercent={entry.completionPercent}
                        status={
                          entry.finishedAt && entry.status !== "COMPLETED"
                            ? "FINISHED"
                            : entry.status
                        }
                        variant="row"
                      />

                      <form action={toggleFavoriteAction}>
                        <input type="hidden" name="entryId" value={entry.id} />
                        <button
                          type="submit"
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-full transition-colors hover:bg-clay-soft"
                          aria-label={
                            entry.isFavorite
                              ? `Remove ${entry.game.name} from favorites`
                              : `Add ${entry.game.name} to favorites`
                          }
                          title={
                            entry.isFavorite
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                        >
                          <HeartIcon
                            filled={Boolean(entry.isFavorite)}
                            className={cn(
                              "h-4 w-4",
                              entry.isFavorite ? "text-clay" : "text-edge",
                            )}
                          />
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center">
                  <p className="font-display text-lg">Nothing here yet.</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    Sync Steam or import a CSV from the Overview tab whenever
                    you&apos;re ready.
                  </p>
                </div>
              )}
            </section>
          ) : null}

          {/* ── Grid View ── */}
          {gamesView === "grid" ? (
            <section>
              {gameEntries.length ? (
                <div className="grid grid-cols-5 gap-4 max-lg:grid-cols-4 max-md:grid-cols-3 max-sm:grid-cols-2">
                  {gameEntries.map((entry) => (
                    <div
                      className="grid scroll-mt-6 gap-2 target:rounded-card target:ring-2 target:ring-sky"
                      id={`entry-${entry.id}`}
                      key={`grid-${entry.id}`}
                    >
                      <GameCard
                        game={entry.game}
                        platformName={entry.platformName}
                        playtimeMinutes={entry.playtimeMinutes}
                        completionPercent={entry.completionPercent}
                        status={
                          entry.finishedAt && entry.status !== "COMPLETED"
                            ? "FINISHED"
                            : entry.status
                        }
                        variant="shelf"
                      />
                      <form action={toggleFavoriteAction}>
                        <input type="hidden" name="entryId" value={entry.id} />
                        <button
                          type="submit"
                          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-pill border border-edge bg-surface px-3 py-1.5 text-xs font-bold text-ink-soft shadow-rest transition-colors hover:bg-clay-soft hover:text-clay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                          aria-label={
                            entry.isFavorite
                              ? `Remove ${entry.game.name} from favorites`
                              : `Add ${entry.game.name} to favorites`
                          }
                          title={
                            entry.isFavorite
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                        >
                          <HeartIcon
                            filled={Boolean(entry.isFavorite)}
                            className={cn(
                              "h-3.5 w-3.5",
                              entry.isFavorite ? "text-clay" : "text-edge",
                            )}
                          />
                          {entry.isFavorite ? "Favorite" : "Add favorite"}
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Nothing here yet.">
                  Sync Steam or import a CSV from the Overview tab whenever
                  you&apos;re ready.
                </EmptyState>
              )}
            </section>
          ) : null}
        </>
      ) : null}
      </div>
    </main>
  );
}

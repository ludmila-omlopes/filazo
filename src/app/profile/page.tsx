import { redirect } from "next/navigation";
import { AssistantCorner, AssistantTab } from "./_components/assistant-tab";
import { CurrentPlayingPanel } from "./_components/current-playing-panel";
import { FavoriteGames } from "./_components/favorite-games";
import { GreetingStrip } from "./_components/greeting-strip";
import { IntegrationsPanel } from "./_components/integrations-panel";
import { JournalTab } from "./_components/journal-tab";
import { OnboardingPanel } from "./_components/onboarding-panel";
import {
  ProfileErrorPanel,
  SignedOutPanel,
} from "./_components/profile-empty-panels";
import { ProfileRail } from "./_components/profile-rail";
import {
  filterEntries,
  getStatusMessage,
  parseActiveStatus,
  parseActiveTab,
  parseAssistantSignal,
  parseSetupStep,
  type ProfileSearchParams,
} from "./_components/profile-query";
import { ShelfGrid } from "./_components/shelf-grid";
import { Notice } from "@/components/ui/notice";
import { getBetaAccessRedirect, getSessionUserWithBeta } from "@/lib/beta-access";
import { getRequestLocale } from "@/lib/request-locale";
import {
  getAssistantProfileData,
  getAssistantSignalEntryIds,
} from "@/lib/assistant/queries";
import { getPlayerProfileForUser } from "@/lib/assistant/profile-agent";
import { getProfileData } from "@/lib/catalog";
import {
  parseProfileGameSort,
  sortProfileGameEntries,
} from "@/lib/profile-games";
import { getSessionUserId } from "@/lib/session";

export default async function ProfilePage({
  searchParams,
}: PageProps<"/profile"> & { searchParams: ProfileSearchParams }) {
  const locale = await getRequestLocale();
  const userId = await getSessionUserId();

  if (!userId) {
    return <SignedOutPanel locale={locale} />;
  }

  let sessionUser: Awaited<ReturnType<typeof getSessionUserWithBeta>>;
  try {
    sessionUser = await getSessionUserWithBeta(userId);
  } catch (error) {
    console.error("Could not verify profile access.", error);
    return <ProfileErrorPanel error={error} locale={locale} />;
  }

  if (!sessionUser) {
    redirect("/api/auth/session/clear?next=/login&reason=expired");
  }

  const accessRedirect = getBetaAccessRedirect(sessionUser);

  if (accessRedirect) {
    redirect(accessRedirect);
  }

  let profile: Awaited<ReturnType<typeof getProfileData>>;
  try {
    profile = await getProfileData(userId);
  } catch (error) {
    console.error("Could not load profile data.", error);
    return <ProfileErrorPanel error={error} locale={locale} />;
  }

  if (!profile) {
    redirect("/");
  }

  const query = await searchParams;
  const activeTab = parseActiveTab(query.tab);
  const setupStep = parseSetupStep(query.step);
  const needsFirstSetup =
    !profile.user.onboardingCompletedAt && !profile.user.onboardingSkippedAt;

  if (needsFirstSetup && activeTab === "overview") {
    redirect("/profile?tab=setup");
  }

  const activeSignal = parseAssistantSignal(query.signal);
  const activeStatus = parseActiveStatus(query.status);
  const activePlatform = query.platform?.trim() || null;
  const activeJournalEntryId = query.entryId?.trim() || null;
  const includeDormant = query.includeDormant === "1";
  const queryText = query.q?.trim() ?? "";
  const gamesView = query.view === "grid" ? "grid" : "list";
  const gamesSort = parseProfileGameSort(query.sort);
  const assistant =
    activeTab === "assistant" ? await getAssistantProfileData(userId) : null;
  const playerProfile =
    activeTab === "overview" ? await getPlayerProfileForUser(userId) : null;
  const signalEntryIds =
    activeTab === "games" && activeSignal
      ? await getAssistantSignalEntryIds(userId, activeSignal)
      : null;
  const allEntries = profile.user.gameEntries;
  const visibleEntries = sortProfileGameEntries(
    filterEntries({
      activePlatform,
      activeStatus,
      entries: allEntries,
      includeDormant,
      queryText,
      signalEntryIds,
    }),
    gamesSort,
  );
  const statusMessage = getStatusMessage(locale, query);

  return (
    <main
      id="main-content"
      className="mx-auto grid w-full max-w-[1180px] grid-cols-[260px_minmax(0,1fr)] items-start gap-8 max-lg:grid-cols-1"
    >
      <ProfileRail
        activeTab={activeTab}
        assistant={assistant}
        locale={locale}
        profile={profile}
      />

      <div className="grid min-w-0 gap-7">
        {statusMessage ? (
          <Notice tone={statusMessage.tone}>{statusMessage.message}</Notice>
        ) : null}

        {activeTab === "overview" ? (
          <>
            <GreetingStrip locale={locale} profile={profile} />
            <CurrentPlayingPanel
              locale={locale}
              playerProfile={playerProfile}
              profile={profile}
            />
            <AssistantCorner
              playerProfile={playerProfile}
              profile={profile}
            />
          </>
        ) : null}

        {activeTab === "assistant" && assistant ? (
          <>
            <FavoriteGames locale={locale} profile={profile} />
            <AssistantTab assistant={assistant} />
          </>
        ) : null}

        {activeTab === "integrations" ? (
          <IntegrationsPanel locale={locale} profile={profile} />
        ) : null}

        {activeTab === "setup" ? (
          <OnboardingPanel profile={profile} step={setupStep} />
        ) : null}

        {activeTab === "journal" ? (
          <JournalTab
            activeEntryId={activeJournalEntryId}
            profile={profile}
          />
        ) : null}

        {activeTab === "games" ? (
          <ShelfGrid
            allEntries={allEntries}
            filters={{
              activePlatform,
              activeSignal,
              activeStatus,
              includeDormant,
              queryText,
            }}
            gamesSort={gamesSort}
            gamesView={gamesView}
            locale={locale}
            visibleEntries={visibleEntries}
          />
        ) : null}
      </div>
    </main>
  );
}

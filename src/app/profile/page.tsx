import { redirect } from "next/navigation";
import { AddGamesPanel } from "./_components/add-games-panel";
import { AssistantCorner, AssistantTab } from "./_components/assistant-tab";
import { FavoriteGames } from "./_components/favorite-games";
import { GreetingStrip } from "./_components/greeting-strip";
import { IntegrationsPanel } from "./_components/integrations-panel";
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
  type ProfileSearchParams,
} from "./_components/profile-query";
import { ShelfGrid } from "./_components/shelf-grid";
import { Notice } from "@/components/ui/notice";
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
  const userId = await getSessionUserId();

  if (!userId) {
    return <SignedOutPanel />;
  }

  let profile: Awaited<ReturnType<typeof getProfileData>>;
  try {
    profile = await getProfileData(userId);
  } catch (error) {
    console.error("Could not load profile data.", error);
    return <ProfileErrorPanel error={error} />;
  }

  if (!profile) {
    redirect("/");
  }

  const query = await searchParams;
  const activeTab = parseActiveTab(query.tab);
  const activeSignal = parseAssistantSignal(query.signal);
  const activeStatus = parseActiveStatus(query.status);
  const activePlatform = query.platform?.trim() || null;
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
      queryText,
      signalEntryIds,
    }),
    gamesSort,
  );
  const statusMessage = getStatusMessage(query);

  return (
    <main
      id="main-content"
      className="mx-auto grid w-full max-w-[1180px] grid-cols-[260px_minmax(0,1fr)] items-start gap-8 max-lg:grid-cols-1"
    >
      <ProfileRail
        activeTab={activeTab}
        assistant={assistant}
        profile={profile}
      />

      <div className="grid min-w-0 gap-7">
        {statusMessage ? (
          <Notice tone={statusMessage.tone}>{statusMessage.message}</Notice>
        ) : null}

        {activeTab === "overview" ? (
          <>
            <GreetingStrip profile={profile} />
            <FavoriteGames profile={profile} />
            <AssistantCorner
              playerProfile={playerProfile}
              profile={profile}
            />
            <AddGamesPanel profile={profile} />
          </>
        ) : null}

        {activeTab === "assistant" && assistant ? (
          <AssistantTab assistant={assistant} />
        ) : null}

        {activeTab === "integrations" ? (
          <IntegrationsPanel profile={profile} />
        ) : null}

        {activeTab === "games" ? (
          <ShelfGrid
            allEntries={allEntries}
            filters={{
              activePlatform,
              activeSignal,
              activeStatus,
              queryText,
            }}
            gamesSort={gamesSort}
            gamesView={gamesView}
            visibleEntries={visibleEntries}
          />
        ) : null}
      </div>
    </main>
  );
}

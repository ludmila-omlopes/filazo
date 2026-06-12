import { BacklogDiagnosis } from "@/components/assistant/backlog-diagnosis";
import { BuyDecisionForm } from "@/components/assistant/buy-decision-form";
import { LibraryChat } from "@/components/assistant/library-chat";
import { PlayNextPanel } from "@/components/assistant/play-next-panel";
import { PlayerProfilePanel } from "@/components/assistant/player-profile-panel";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import Link from "next/link";
import { formatNumber } from "@/lib/utils";
import {
  generatePlayerProfileAction,
  refreshAssistantInsightsAction,
} from "../assistant-actions";
import type {
  AssistantData,
  PlayerProfileData,
  ProfileData,
} from "./profile-types";

function formatAssistantCooldown(seconds: number) {
  if (seconds <= 0) {
    return "available now";
  }

  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "in 1 minute" : `in ${minutes} minutes`;
}

export function AssistantCorner({
  playerProfile,
  profile,
}: {
  playerProfile: PlayerProfileData;
  profile: ProfileData;
}) {
  return (
    <section className="grid gap-5 rounded-card border border-edge bg-dusk-lavender-soft p-6 shadow-rest">
      <SectionHeader
        eyebrow="Assistant corner"
        title="A librarian for the shelf"
        aside={
          <Button asChild size="sm" variant="ghost">
            <Link href="/tonight">Open tonight</Link>
          </Button>
        }
      />
      <PlayerProfilePanel
        action={generatePlayerProfileAction}
        aiConfigured={Boolean(process.env.OPENAI_API_KEY)}
        hasGames={
          profile.ownedEntries.length + profile.wishlistEntries.length > 0
        }
        profile={playerProfile}
      />
    </section>
  );
}

export function AssistantTab({ assistant }: { assistant: AssistantData }) {
  if (!assistant) {
    return null;
  }

  return (
    <>
      <section className="flex items-center justify-between gap-4 rounded-card border border-edge bg-dusk-lavender-soft px-6 py-5 shadow-rest max-md:flex-col max-md:items-start">
        <div>
          <p className="section-label !mb-1">Shelf companion</p>
          <p className="text-sm font-semibold leading-snug">
            Refresh insights after syncs, imports, or status changes.
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            AI explanations are optional. Rule-based suggestions work without an
            API key.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-soft">
            <span className="rounded-full bg-surface px-3 py-1">
              AI notes available today:{" "}
              {formatNumber(assistant.aiUsage.effectiveRemainingToday)}
            </span>
            <span className="rounded-full bg-surface px-3 py-1">
              Today&apos;s AI notes: {formatNumber(assistant.aiUsage.userUsedToday)} /{" "}
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
          <Button type="submit">Refresh assistant</Button>
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
  );
}

import Link from "next/link";
import type { StoredPlayerProfile } from "@/lib/assistant/profile-agent";
import { SyncActionForm } from "@/components/sync-action-form";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export function PlayerProfilePanel({
  profile,
  hasGames,
  aiConfigured,
  action,
}: {
  profile: StoredPlayerProfile | null;
  hasGames: boolean;
  aiConfigured: boolean;
  action: (formData: FormData) => void;
}) {
  return (
    <section className="panel">
      <div className="mb-6 flex items-end justify-between gap-4 max-lg:flex-col max-lg:items-start">
        <div>
          <span className="section-label">Player profile</span>
          <h2 className="text-section-title leading-snug">
            Who you are as a player
          </h2>
          <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-ink-soft">
            Written by an AI agent from your library, playtime, and reviews.
            Regenerate it after adding feedback.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 max-lg:items-start">
          <div className="pill">
            {profile
              ? `Generated ${formatDate(profile.updatedAt)}`
              : "Not generated yet"}
          </div>
          {hasGames && aiConfigured ? (
            <SyncActionForm
              action={action}
              buttonLabel={profile ? "Refresh profile" : "Generate profile"}
              pendingLabel="Agent reading your shelf..."
              pendingNotice="The profile agent is querying your library, feedback, and reviews. Keep this page open."
            />
          ) : profile && !aiConfigured ? (
            <p className="text-xs font-semibold text-ink-soft">
              Set OPENAI_API_KEY to regenerate.
            </p>
          ) : null}
        </div>
      </div>

      {!hasGames ? (
        <EmptyState title="Your shelf is quiet right now.">
          Sync Steam, Xbox, or PlayStation, or import a CSV. The profile agent
          needs a few games before it can say anything useful about your taste.
        </EmptyState>
      ) : !profile && !aiConfigured ? (
        <div className="rounded-card border border-edge bg-clay-soft p-5">
          <p className="font-semibold">AI module unavailable.</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Player profile generation needs OPENAI_API_KEY. The rest of the
            assistant keeps working with rule-based signals.
          </p>
        </div>
      ) : !profile ? (
        <EmptyState title="Your profile hasn't been written yet.">
          Use Generate profile and the agent will explore your games,
          playtime, favorites, and feedback to draft it.
        </EmptyState>
      ) : (
        <div className="grid gap-5">
          <p className="rounded-card border border-edge bg-sage-soft p-5 leading-relaxed">
            {profile.payload.summary}
          </p>

          {profile.payload.preferredGenres.length ? (
            <div>
              <h3 className="section-label !mb-2">Preferred genres</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {profile.payload.preferredGenres.map((item) => (
                  <div
                    className="rounded-inner border border-edge bg-surface px-3.5 py-2.5"
                    key={item.genre}
                  >
                    <strong className="block text-sm">{item.genre}</strong>
                    <span className="text-xs leading-snug text-ink-soft">
                      {item.evidence}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2">
            {profile.payload.playStyles.length ? (
              <div>
                <h3 className="section-label !mb-2">Play styles</h3>
                <ul className="grid gap-1.5 text-sm leading-relaxed">
                  {profile.payload.playStyles.map((style) => (
                    <li className="flex gap-2" key={style}>
                      <span aria-hidden className="text-sage">
                        •
                      </span>
                      {style}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {profile.payload.behaviorPatterns.length ? (
              <div>
                <h3 className="section-label !mb-2">Behavior patterns</h3>
                <ul className="grid gap-1.5 text-sm leading-relaxed">
                  {profile.payload.behaviorPatterns.map((pattern) => (
                    <li className="flex gap-2" key={pattern}>
                      <span aria-hidden className="text-sage">
                        •
                      </span>
                      {pattern}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {profile.payload.recommendations.length ? (
            <div>
              <h3 className="section-label !mb-2">From your own shelf</h3>
              <div className="grid gap-2">
                {profile.payload.recommendations.map((recommendation) => (
                  <Link
                    className="rounded-inner border border-edge bg-sky-soft px-3.5 py-2.5 transition-[box-shadow] hover:shadow-rest motion-safe:transition-[transform,box-shadow] motion-safe:hover:-translate-y-0.5"
                    href={`/games/${recommendation.slug}`}
                    key={recommendation.slug}
                  >
                    <strong className="block text-sm">
                      {recommendation.title}
                    </strong>
                    <span className="text-xs leading-snug text-ink-soft">
                      {recommendation.reason}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {profile.payload.dataNotes.length ? (
            <ul className="grid gap-1 text-xs text-ink-soft">
              {profile.payload.dataNotes.map((note) => (
                <li key={note}>· {note}</li>
              ))}
            </ul>
          ) : null}

          {profile.toolTrace.length ? (
            <details className="text-xs text-ink-soft">
              <summary className="cursor-pointer font-bold tracking-wide">
                How the agent built this ({profile.toolTrace.length} tool calls)
              </summary>
              <ol className="mt-2 grid gap-1">
                {profile.toolTrace.map((step, index) => (
                  <li key={`${step.tool}-${index}`}>
                    {index + 1}. <code>{step.tool}</code>
                    {step.resultSummary ? ` — ${step.resultSummary}` : ""}
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>
      )}
    </section>
  );
}

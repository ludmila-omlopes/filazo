"use client";

import { useState } from "react";
import { Camera, ChevronDown, ImageIcon, Mic, PenLine } from "lucide-react";
import { JournalSubmitButton } from "./journal-submit-button";
import { useJournalDraft, type JournalDraft } from "./use-journal-draft";
import { useTranslations } from "@/components/locale-provider";
import { VoiceMemoryInput } from "@/components/voice-memory-input";
import { cn } from "@/lib/utils";

type ComposerMode = "voice" | "text";

function ModeButton({
  active,
  hint,
  icon,
  iconClassName,
  label,
  onClick,
}: {
  active: boolean;
  hint: string;
  icon: React.ReactNode;
  iconClassName: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "flex min-w-0 items-start gap-3 rounded-inner border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface max-sm:p-3",
        active
          ? "border-ink bg-surface shadow-rest"
          : "border-edge bg-canvas/70 hover:bg-canvas",
      )}
      onClick={onClick}
      type="button"
    >
      <span
        className={cn(
          "grid h-10 w-10 flex-none place-items-center rounded-inner border border-edge text-ink",
          iconClassName,
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-pretty font-display text-xl font-medium">
          {label}
        </span>
        <span className="mt-1 block text-sm font-semibold leading-relaxed text-ink-soft">
          {hint}
        </span>
      </span>
    </button>
  );
}

export function JournalComposer({
  maxRecordingSeconds,
  draftKey,
  initial,
}: {
  maxRecordingSeconds: number;
  draftKey: string;
  initial?: JournalDraft;
}) {
  const t = useTranslations();
  const [mode, setMode] = useState<ComposerMode>("text");
  const { draft, updateDraft, savedLocally, ready } = useJournalDraft(
    draftKey,
    initial,
  );
  const date = draft.occurredAt ? new Date(draft.occurredAt) : null;
  const occurredAt =
    date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";

  function toggleMode(next: ComposerMode) {
    setMode(next);
  }

  return (
    <fieldset className="grid min-w-0 gap-4" disabled={!ready}>
      <input name="occurredAt" type="hidden" value={occurredAt} />
      {!initial ? (
        <div>
          <p className="section-label !mb-3">{t("journal.modePrompt")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeButton
              active={mode === "voice"}
              hint={t("journal.recordWithVoiceHint")}
              icon={<Mic aria-hidden="true" className="h-4 w-4" />}
              iconClassName="bg-sage-soft"
              label={t("journal.recordWithVoice")}
              onClick={() => toggleMode("voice")}
            />
            <ModeButton
              active={mode === "text"}
              hint={t("journal.writeWithTextHint")}
              icon={<PenLine aria-hidden="true" className="h-4 w-4" />}
              iconClassName="bg-sand-soft"
              label={t("journal.writeWithText")}
              onClick={() => toggleMode("text")}
            />
          </div>
        </div>
      ) : null}

      {!initial ? (
        <section
          className={cn(
            "rounded-inner border border-edge bg-canvas/70 p-4 max-sm:p-3",
            mode === "voice" ? "grid gap-3" : "hidden",
          )}
        >
          <VoiceMemoryInput
            active={mode === "voice"}
            framed={false}
            maxRecordingSeconds={maxRecordingSeconds}
            showIntro={false}
          />
        </section>
      ) : null}

      <section
        className={cn(
          "rounded-inner border border-edge bg-canvas/70 p-4 max-sm:p-3",
          mode === "text" ? "grid gap-4" : "hidden",
        )}
      >
        <label className="grid gap-2">
          <span className="text-sm font-semibold">
            {t("journal.pageTitle")}
          </span>
          <input
            autoComplete="off"
            className="min-h-11 rounded-inner border border-edge bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            name="title"
            maxLength={160}
            value={draft.title}
            onChange={(event) => updateDraft({ title: event.target.value })}
            placeholder={t("journal.pageTitlePlaceholder")}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">
            {t("journal.dearDiary")}
          </span>
          <textarea
            autoComplete="off"
            className="min-h-40 rounded-inner border border-edge bg-surface px-3 py-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            name="body"
            maxLength={4000}
            value={draft.body}
            onChange={(event) => updateDraft({ body: event.target.value })}
            placeholder={t("journal.bodyPlaceholder")}
          />
        </label>
      </section>

      <p className="text-xs leading-relaxed text-ink-soft" role="status">
        {savedLocally ? t("journal.draftSaved") : t("journal.draftHint")}
      </p>
      {mode === "voice" && (draft.title || draft.body) ? (
        <p className="text-sm text-ink-soft">{t("journal.textIncluded")}</p>
      ) : null}

      {mode ? (
        <>
          <details className="group/extras rounded-inner border border-edge bg-canvas/70">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-inner p-4 transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface max-sm:p-3 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-inner border border-edge bg-sky-soft text-ink">
                  <ImageIcon aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-pretty font-display text-xl font-medium">
                    {t(
                      initial ? "journal.playedAround" : "journal.extrasTitle",
                    )}
                  </span>
                  <span className="mt-1 block text-sm font-semibold leading-relaxed text-ink-soft">
                    {t(
                      initial ? "journal.editMediaHint" : "journal.extrasHint",
                    )}
                  </span>
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="h-4 w-4 flex-none text-ink-soft motion-safe:transition-transform group-open/extras:rotate-180"
              />
            </summary>

            <div className="grid gap-3 border-t border-edge p-4 max-sm:p-3 sm:grid-cols-2">
              {!initial ? (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">
                    {t("journal.imageFromDevice")}
                  </span>
                  <input
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="w-full text-sm file:mr-3 file:cursor-pointer file:rounded-pill file:border file:border-edge file:bg-sage-soft file:px-4 file:py-2 file:font-semibold file:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                    name="image"
                    type="file"
                  />
                </label>
              ) : null}
              {!initial ? (
                <label className="grid gap-2 sm:hidden">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Camera aria-hidden="true" className="h-4 w-4" />
                    {t("journal.takePhoto")}
                  </span>
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="w-full text-sm file:mr-3 file:cursor-pointer file:rounded-pill file:border file:border-edge file:bg-sky-soft file:px-4 file:py-2 file:font-semibold file:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                    name="image"
                    type="file"
                  />
                </label>
              ) : null}
              <label className="grid gap-2">
                <span className="text-sm font-semibold">
                  {t("journal.playedAround")}
                </span>
                <input
                  autoComplete="off"
                  className="min-h-11 rounded-inner border border-edge bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  value={ready ? draft.occurredAt : ""}
                  onChange={(event) =>
                    updateDraft({ occurredAt: event.target.value })
                  }
                  type="datetime-local"
                />
              </label>
            </div>
          </details>

          <JournalSubmitButton
            label={t(initial ? "journal.saveChanges" : "journal.savePage")}
            pendingLabel={t("journal.savingPage")}
          />
        </>
      ) : null}
    </fieldset>
  );
}

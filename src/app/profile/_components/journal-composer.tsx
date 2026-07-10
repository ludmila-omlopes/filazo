"use client";

import { useState } from "react";
import { ChevronDown, ImageIcon, Mic, PenLine } from "lucide-react";
import { JournalSubmitButton } from "./journal-submit-button";
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
}: {
  maxRecordingSeconds: number;
}) {
  const t = useTranslations();
  const [mode, setMode] = useState<ComposerMode | null>(null);

  function toggleMode(next: ComposerMode) {
    setMode((current) => (current === next ? null : next));
  }

  return (
    <div className="grid gap-4">
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

      {mode === "voice" ? (
        <section className="grid gap-3 rounded-inner border border-edge bg-canvas/70 p-4 max-sm:p-3">
          <VoiceMemoryInput
            framed={false}
            maxRecordingSeconds={maxRecordingSeconds}
            showIntro={false}
          />
        </section>
      ) : null}

      {mode === "text" ? (
        <section className="grid gap-4 rounded-inner border border-edge bg-canvas/70 p-4 max-sm:p-3">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">
              {t("journal.pageTitle")}
            </span>
            <input
              autoComplete="off"
              className="min-h-11 rounded-inner border border-edge bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              name="title"
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
              placeholder={t("journal.bodyPlaceholder")}
            />
          </label>
        </section>
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
                    {t("journal.extrasTitle")}
                  </span>
                  <span className="mt-1 block text-sm font-semibold leading-relaxed text-ink-soft">
                    {t("journal.extrasHint")}
                  </span>
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="h-4 w-4 flex-none text-ink-soft motion-safe:transition-transform group-open/extras:rotate-180"
              />
            </summary>

            <div className="grid gap-3 border-t border-edge p-4 max-sm:p-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">
                  {t("journal.screenshot")}
                </span>
                <input
                  accept="image/*"
                  className="w-full text-sm file:mr-3 file:cursor-pointer file:rounded-pill file:border file:border-edge file:bg-sage-soft file:px-4 file:py-2 file:font-semibold file:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  name="image"
                  type="file"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">
                  {t("journal.playedAround")}
                </span>
                <input
                  autoComplete="off"
                  className="min-h-11 rounded-inner border border-edge bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  name="occurredAt"
                  type="datetime-local"
                />
              </label>
            </div>
          </details>

          <JournalSubmitButton
            label={t("journal.savePage")}
            pendingLabel={t("journal.savingPage")}
          />
        </>
      ) : null}
    </div>
  );
}

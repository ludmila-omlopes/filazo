import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils";
import {
  clearOnboardingAction,
  saveOnboardingStepAction,
  skipOnboardingAction,
} from "../actions";
import type { SetupStep } from "./profile-query";
import type { ProfileData } from "./profile-types";

type OnboardingAnswers = {
  playFrequency?: string;
  playTimes?: string[];
  platforms?: string[];
  otherPlatform?: string;
};

const steps: Array<{
  id: SetupStep;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
}> = [
  {
    id: "rhythm",
    label: "Rhythm",
    eyebrow: "Step 1 of 2",
    title: "Set Your Play Rhythm",
    description:
      "Give the guide a rough sense of when you actually play, so suggestions do not feel too heavy for your week.",
  },
  {
    id: "platforms",
    label: "Platforms",
    eyebrow: "Step 2 of 2",
    title: "Choose Main Platforms",
    description:
      "These are catalog hints only. Account connections and imports still live in Sources.",
  },
];

const playFrequencyOptions = [
  ["", "Skip frequency"],
  ["a few times a month", "A few times a month"],
  ["1-2 times a week", "1-2 times a week"],
  ["several times a week", "Several times a week"],
  ["daily", "Daily"],
  ["multiple times a day", "Multiple times a day"],
];

const playTimeOptions: Array<[string, string]> = [
  ["morning", "Morning"],
  ["afternoon", "Afternoon"],
  ["evening", "Evening"],
  ["late night", "Late night"],
  ["weekdays", "Weekdays"],
  ["weekends", "Weekends"],
];

const platformOptions: Array<[string, string]> = [
  ["pc", "PC"],
  ["steam-deck", "Steam Deck"],
  ["playstation", "PlayStation"],
  ["xbox", "Xbox"],
  ["nintendo", "Switch / Nintendo"],
  ["mobile", "Mobile"],
  ["handheld", "Other handheld"],
];

function readAnswers(profile: ProfileData): OnboardingAnswers {
  const value = profile.user.onboardingAnswers;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as OnboardingAnswers;
}

function checked(values: string[] | undefined, value: string) {
  return values?.includes(value) ?? false;
}

function getStepIndex(step: SetupStep) {
  return steps.findIndex((item) => item.id === step);
}

function getPreviousStep(step: SetupStep) {
  const previous = steps[getStepIndex(step) - 1];
  return previous?.id ?? null;
}

function CheckboxGroup({
  name,
  options,
  values,
}: {
  name: string;
  options: Array<[string, string]>;
  values?: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([value, label]) => (
        <label
          className="inline-flex min-h-10 items-center gap-2 rounded-pill border border-edge bg-canvas px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-surface"
          key={value}
        >
          <input
            autoComplete="off"
            className="h-4 w-4 accent-ink"
            defaultChecked={checked(values, value)}
            name={name}
            type="checkbox"
            value={value}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function SetupProgress({ activeStep }: { activeStep: SetupStep }) {
  const activeIndex = getStepIndex(activeStep);

  return (
    <ol
      aria-label="Setup progress"
      className="grid grid-cols-2 gap-2 max-sm:grid-cols-1"
    >
      {steps.map((step, index) => {
        const isActive = step.id === activeStep;
        const isDone = index < activeIndex;

        return (
          <li
            aria-current={isActive ? "step" : undefined}
            className={cn(
              "rounded-inner border px-3 py-2 text-sm",
              isActive
                ? "border-ink bg-ink text-surface"
                : isDone
                  ? "border-sage bg-sage-soft text-ink"
                  : "border-edge bg-surface text-ink-soft",
            )}
            key={step.id}
          >
            <span
              className={cn(
                "block text-[0.62rem] font-bold uppercase tracking-wide",
                isActive ? "text-surface/70" : "text-ink-soft",
              )}
            >
              {step.eyebrow}
            </span>
            <span className="font-bold">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function StepActions({
  isFinalStep,
  previousStep,
}: {
  isFinalStep: boolean;
  previousStep: SetupStep | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-4">
      {previousStep ? (
        <Button asChild size="sm" variant="ghost">
          <Link href={`/profile?tab=setup&step=${previousStep}`}>Back</Link>
        </Button>
      ) : (
        <span aria-hidden />
      )}
      <Button type="submit">
        {isFinalStep ? "Finish Setup" : "Save & Continue"}
      </Button>
    </div>
  );
}

function RhythmStep({
  answers,
  previousStep,
}: {
  answers: OnboardingAnswers;
  previousStep: SetupStep | null;
}) {
  return (
    <form action={saveOnboardingStepAction} className="grid gap-5">
      <input type="hidden" name="step" value="rhythm" />
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Play frequency</span>
        <select
          autoComplete="off"
          className="min-h-11 rounded-inner border border-edge bg-canvas px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          defaultValue={answers.playFrequency ?? ""}
          name="playFrequency"
        >
          {playFrequencyOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">Usual play windows</legend>
        <CheckboxGroup
          name="playTimes"
          options={playTimeOptions}
          values={answers.playTimes}
        />
      </fieldset>

      <StepActions isFinalStep={false} previousStep={previousStep} />
    </form>
  );
}

function PlatformsStep({
  answers,
  previousStep,
}: {
  answers: OnboardingAnswers;
  previousStep: SetupStep | null;
}) {
  return (
    <form action={saveOnboardingStepAction} className="grid gap-5">
      <input type="hidden" name="step" value="platforms" />
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">Current platforms</legend>
        <CheckboxGroup
          name="platforms"
          options={platformOptions}
          values={answers.platforms}
        />
      </fieldset>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Other platform</span>
        <input
          autoComplete="off"
          className="min-h-11 rounded-inner border border-edge bg-canvas px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          defaultValue={answers.otherPlatform ?? ""}
          name="otherPlatform"
          placeholder="Example: Analogue Pocket…"
        />
      </label>

      <StepActions isFinalStep previousStep={previousStep} />
    </form>
  );
}

function SetupMaintenance({ hasCompleted }: { hasCompleted: boolean }) {
  return (
    <div className="flex flex-wrap items-start gap-4 border-t border-edge pt-4 text-sm">
      {!hasCompleted ? (
        <form action={skipOnboardingAction}>
          <Button size="sm" type="submit" variant="link">
            Skip Setup For Now
          </Button>
        </form>
      ) : null}
      <details className="group">
        <summary className="cursor-pointer rounded-inner px-1 py-1 font-bold text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
          Clean Choices
        </summary>
        <div className="mt-3 grid gap-3 rounded-inner border border-edge bg-surface p-4 text-ink-soft shadow-rest">
          <p>This clears setup answers and restarts the setup flow.</p>
          <form action={clearOnboardingAction}>
            <Button size="sm" type="submit" variant="ghost">
              Confirm Clean
            </Button>
          </form>
        </div>
      </details>
    </div>
  );
}

export function OnboardingPanel({
  profile,
  step,
}: {
  profile: ProfileData;
  step: SetupStep;
}) {
  const answers = readAnswers(profile);
  const hasCompleted = Boolean(profile.user.onboardingCompletedAt);
  const hasSkipped = Boolean(profile.user.onboardingSkippedAt) && !hasCompleted;
  const isFirstSetup = !hasCompleted && !hasSkipped;
  const activeStep = steps[getStepIndex(step)] ?? steps[0];
  const previousStep = getPreviousStep(activeStep.id);

  return (
    <section className="grid gap-5">
      <section className="panel bg-sand-soft/70">
        <SectionHeader
          eyebrow="Setup"
          title={
            hasCompleted
              ? "Play Preferences"
              : hasSkipped
                ? "Setup Is Optional"
                : "Start With A Light Setup"
          }
          description={
            isFirstSetup
              ? "Answer only what helps. Each step saves before moving on."
              : "Adjust the preferences that shape recommendations and source prompts."
          }
          aside={
            hasCompleted ? (
              <Button asChild size="sm" variant="ghost">
                <Link href="/profile?tab=integrations">Open Sources</Link>
              </Button>
            ) : null
          }
        />

        <div className="grid gap-5">
          <SetupProgress activeStep={activeStep.id} />

          <div className="rounded-card border border-edge bg-surface p-5 shadow-rest">
            <div className="mb-5">
              <p className="section-label !mb-2">{activeStep.eyebrow}</p>
              <h3 className="text-balance text-xl leading-tight">
                {activeStep.title}
              </h3>
              <p className="mt-2 max-w-[62ch] text-pretty text-sm leading-relaxed text-ink-soft">
                {activeStep.description}
              </p>
            </div>

            {activeStep.id === "rhythm" ? (
              <RhythmStep answers={answers} previousStep={previousStep} />
            ) : null}
            {activeStep.id === "platforms" ? (
              <PlatformsStep answers={answers} previousStep={previousStep} />
            ) : null}
          </div>

          <SetupMaintenance hasCompleted={hasCompleted} />
        </div>
      </section>
    </section>
  );
}

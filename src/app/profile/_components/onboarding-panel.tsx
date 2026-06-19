import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { createTranslator, type Locale } from "@/lib/i18n";
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

function getSteps(t: ReturnType<typeof createTranslator>) {
  return [
    {
      id: "rhythm" as const,
      label: t("setup.step.rhythm"),
      eyebrow: t("setup.step1"),
      title: t("setup.rhythm.title"),
      description: t("setup.rhythm.description"),
    },
    {
      id: "platforms" as const,
      label: t("setup.step.platforms"),
      eyebrow: t("setup.step2"),
      title: t("setup.platforms.title"),
      description: t("setup.platforms.description"),
    },
  ];
}

function getPlayFrequencyOptions(t: ReturnType<typeof createTranslator>) {
  return [
    ["", t("setup.frequency.skip")],
    ["a few times a month", t("setup.frequency.monthly")],
    ["1-2 times a week", t("setup.frequency.weekly12")],
    ["several times a week", t("setup.frequency.weeklyMany")],
    ["daily", t("setup.frequency.daily")],
    ["multiple times a day", t("setup.frequency.multiDaily")],
  ] as const;
}

function getPlayTimeOptions(t: ReturnType<typeof createTranslator>): Array<[string, string]> {
  return [
    ["morning", t("setup.window.morning")],
    ["afternoon", t("setup.window.afternoon")],
    ["evening", t("setup.window.evening")],
    ["late night", t("setup.window.lateNight")],
    ["weekdays", t("setup.window.weekdays")],
    ["weekends", t("setup.window.weekends")],
  ];
}

function getPlatformOptions(t: ReturnType<typeof createTranslator>): Array<[string, string]> {
  return [
    ["pc", "PC"],
    ["steam-deck", "Steam Deck"],
    ["playstation", "PlayStation"],
    ["xbox", "Xbox"],
    ["nintendo", t("setup.platform.nintendo")],
    ["mobile", t("setup.platform.mobile")],
    ["handheld", t("setup.platform.handheld")],
  ];
}

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
  return ["rhythm", "platforms"].findIndex((item) => item === step);
}

function getPreviousStep(step: SetupStep) {
  const orderedSteps: SetupStep[] = ["rhythm", "platforms"];
  return orderedSteps[getStepIndex(step) - 1] ?? null;
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

function SetupProgress({
  activeStep,
  locale,
}: {
  activeStep: SetupStep;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const steps = getSteps(t);
  const activeIndex = getStepIndex(activeStep);

  return (
    <ol
      aria-label={t("setup.progress")}
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
  locale,
  previousStep,
}: {
  isFinalStep: boolean;
  locale: Locale;
  previousStep: SetupStep | null;
}) {
  const t = createTranslator(locale);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-4">
      {previousStep ? (
        <Button asChild size="sm" variant="ghost">
          <Link href={`/profile?tab=setup&step=${previousStep}`}>{t("setup.back")}</Link>
        </Button>
      ) : (
        <span aria-hidden />
      )}
      <Button type="submit">
        {isFinalStep ? t("setup.finish") : t("setup.saveContinue")}
      </Button>
    </div>
  );
}

function RhythmStep({
  answers,
  locale,
  previousStep,
}: {
  answers: OnboardingAnswers;
  locale: Locale;
  previousStep: SetupStep | null;
}) {
  const t = createTranslator(locale);
  const playFrequencyOptions = getPlayFrequencyOptions(t);
  const playTimeOptions = getPlayTimeOptions(t);

  return (
    <form action={saveOnboardingStepAction} className="grid gap-5">
      <input type="hidden" name="step" value="rhythm" />
      <label className="grid gap-2">
        <span className="text-sm font-semibold">{t("setup.playFrequency")}</span>
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
        <legend className="text-sm font-semibold">{t("setup.playWindows")}</legend>
        <CheckboxGroup
          name="playTimes"
          options={playTimeOptions}
          values={answers.playTimes}
        />
      </fieldset>

      <StepActions isFinalStep={false} locale={locale} previousStep={previousStep} />
    </form>
  );
}

function PlatformsStep({
  answers,
  locale,
  previousStep,
}: {
  answers: OnboardingAnswers;
  locale: Locale;
  previousStep: SetupStep | null;
}) {
  const t = createTranslator(locale);
  const platformOptions = getPlatformOptions(t);

  return (
    <form action={saveOnboardingStepAction} className="grid gap-5">
      <input type="hidden" name="step" value="platforms" />
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">{t("setup.currentPlatforms")}</legend>
        <CheckboxGroup
          name="platforms"
          options={platformOptions}
          values={answers.platforms}
        />
      </fieldset>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">{t("setup.otherPlatform")}</span>
        <input
          autoComplete="off"
          className="min-h-11 rounded-inner border border-edge bg-canvas px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          defaultValue={answers.otherPlatform ?? ""}
          name="otherPlatform"
          placeholder={t("setup.otherPlatformPlaceholder")}
        />
      </label>

      <StepActions isFinalStep locale={locale} previousStep={previousStep} />
    </form>
  );
}

function SetupMaintenance({
  hasCompleted,
  locale,
}: {
  hasCompleted: boolean;
  locale: Locale;
}) {
  const t = createTranslator(locale);

  return (
    <div className="flex flex-wrap items-start gap-4 border-t border-edge pt-4 text-sm">
      {!hasCompleted ? (
        <form action={skipOnboardingAction}>
          <Button size="sm" type="submit" variant="link">
            {t("setup.skipNow")}
          </Button>
        </form>
      ) : null}
      <details className="group">
        <summary className="cursor-pointer rounded-inner px-1 py-1 font-bold text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
          {t("setup.cleanChoices")}
        </summary>
        <div className="mt-3 grid gap-3 rounded-inner border border-edge bg-surface p-4 text-ink-soft shadow-rest">
          <p>{t("setup.cleanBody")}</p>
          <form action={clearOnboardingAction}>
            <Button size="sm" type="submit" variant="ghost">
              {t("setup.cleanConfirm")}
            </Button>
          </form>
        </div>
      </details>
    </div>
  );
}

export function OnboardingPanel({
  locale,
  profile,
  step,
}: {
  locale: Locale;
  profile: ProfileData;
  step: SetupStep;
}) {
  const t = createTranslator(locale);
  const steps = getSteps(t);
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
          eyebrow={t("setup.label")}
          title={
            hasCompleted
              ? t("setup.titleCompleted")
              : hasSkipped
                ? t("setup.titleOptional")
                : t("setup.titleStart")
          }
          description={
            isFirstSetup
              ? t("setup.descriptionFirst")
              : t("setup.descriptionEdit")
          }
          aside={
            hasCompleted ? (
              <Button asChild size="sm" variant="ghost">
                <Link href="/profile?tab=integrations">{t("setup.openSources")}</Link>
              </Button>
            ) : null
          }
        />

        <div className="grid gap-5">
          <SetupProgress activeStep={activeStep.id} locale={locale} />

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
              <RhythmStep answers={answers} locale={locale} previousStep={previousStep} />
            ) : null}
            {activeStep.id === "platforms" ? (
              <PlatformsStep answers={answers} locale={locale} previousStep={previousStep} />
            ) : null}
          </div>

          <SetupMaintenance hasCompleted={hasCompleted} locale={locale} />
        </div>
      </section>
    </section>
  );
}

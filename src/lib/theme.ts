export const FILAZO_THEME_COOKIE = "filazo-theme";

/** The resolved light/dark theme actually applied to the UI. */
export type FilazoTheme = "day" | "night";

/** Slices of the day used to tint the global background. Each is selectable as a
 *  fixed mode via the theme slider; "auto" cycles through them by local time. */
export type FilazoPhase =
  | "morning"
  | "afternoon"
  | "dusk"
  | "evening"
  | "night";

/** The five phases in day order — drives the theme slider stops. */
export const FILAZO_PHASES: FilazoPhase[] = [
  "morning",
  "afternoon",
  "dusk",
  "evening",
  "night",
];

/** What the user picked: a fixed phase, or "auto" (follows local time of day). */
export type FilazoThemeMode = FilazoPhase | "auto";

function isFilazoPhase(value: unknown): value is FilazoPhase {
  return (FILAZO_PHASES as string[]).includes(value as string);
}

export function parseFilazoThemeMode(value: unknown): FilazoThemeMode {
  if (value === "auto" || isFilazoPhase(value)) {
    return value;
  }
  // Legacy fixed modes: "day" browsed light, "night" was the darkest phase.
  if (value === "night") return "night";
  return "afternoon";
}

export function phaseFromHour(hour: number): FilazoPhase {
  if (hour < 6) return "night";
  if (hour < 11) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 19) return "dusk";
  if (hour < 21) return "evening";
  return "night";
}

/** Resolve a mode to its active phase: the chosen phase, or the current one in
 *  auto. */
export function phaseForMode(mode: FilazoThemeMode, hour: number): FilazoPhase {
  return mode === "auto" ? phaseFromHour(hour) : mode;
}

/** Morning and afternoon read as the light theme; dusk onward goes dark. */
export function themeForPhase(phase: FilazoPhase): FilazoTheme {
  return phase === "morning" || phase === "afternoon" ? "day" : "night";
}

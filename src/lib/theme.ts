export const FILAZO_THEME_COOKIE = "filazo-theme";

/** What the user picked. "auto" follows the visitor's local time of day. */
export type FilazoThemeMode = "day" | "night" | "auto";

/** The resolved light/dark theme actually applied to the UI. */
export type FilazoTheme = "day" | "night";

/** Slices of the day used to tint the global background in auto mode. */
export type FilazoPhase =
  | "morning"
  | "afternoon"
  | "dusk"
  | "evening"
  | "night";

export function parseFilazoThemeMode(value: unknown): FilazoThemeMode {
  return value === "night" || value === "auto" ? value : "day";
}

export function phaseFromHour(hour: number): FilazoPhase {
  if (hour < 6) return "night";
  if (hour < 11) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 19) return "dusk";
  if (hour < 21) return "evening";
  return "night";
}

/** Morning and afternoon read as the light theme; dusk onward goes dark. */
export function themeForPhase(phase: FilazoPhase): FilazoTheme {
  return phase === "morning" || phase === "afternoon" ? "day" : "night";
}

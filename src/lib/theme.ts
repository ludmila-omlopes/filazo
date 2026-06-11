export const FILAZO_THEME_COOKIE = "filazo-theme";

export type FilazoTheme = "day" | "night";

export function parseFilazoTheme(value: unknown): FilazoTheme {
  return value === "night" ? "night" : "day";
}

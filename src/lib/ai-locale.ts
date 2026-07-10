import type { Locale } from "@/lib/i18n";

export function getAiOutputLanguageInstruction(locale: Locale) {
  return locale === "pt-BR"
    ? "Output-language requirement: write every user-facing natural-language field exclusively in Brazilian Portuguese (pt-BR). Translate genre labels and explanations too. Keep only game titles and slugs exactly as provided by the catalog."
    : "Output-language requirement: write every user-facing natural-language field exclusively in clear, natural English.";
}

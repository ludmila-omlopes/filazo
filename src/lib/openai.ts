const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

export type OpenAiConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

/**
 * Base URL for OpenAI-compatible chat/responses calls.
 *
 * Defaults to OpenAI, but can point at any OpenAI-compatible gateway (such as
 * OpenRouter) via `OPENAI_BASE_URL`. This is how the app gets multi-provider
 * model options: set `OPENAI_BASE_URL=https://openrouter.ai/api/v1`, an
 * OpenRouter key in `OPENAI_API_KEY`, and a routed `OPENAI_MODEL` like
 * `anthropic/claude-opus-4.8`.
 *
 * The value must include the API version segment (e.g. `.../v1`). Trailing
 * slashes are trimmed so callers can safely append `/responses` or
 * `/chat/completions`.
 */
export function getOpenAiBaseUrl(): string {
  const raw = process.env.OPENAI_BASE_URL?.trim();
  return (raw || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
}

/**
 * Shared config for OpenAI-compatible text generation. Returns `null` when no
 * key is set so callers can degrade to their rule-based fallbacks.
 */
export function getOpenAiConfig(): OpenAiConfig | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    baseUrl: getOpenAiBaseUrl(),
  };
}

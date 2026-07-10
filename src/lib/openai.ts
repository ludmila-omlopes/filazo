const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export type OpenAiConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
  provider: "openai" | "openrouter" | "compatible";
};

function readEnv(name: string) {
  return process.env[name]?.trim() || null;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function isOpenRouterBaseUrl(value: string) {
  try {
    return new URL(value).hostname === "openrouter.ai";
  } catch {
    return false;
  }
}

/**
 * Base URL for OpenAI-compatible chat/responses calls.
 *
 * `OPENAI_BASE_URL` remains the backwards-compatible direct OpenAI/gateway
 * override. New multi-provider configuration uses `AI_PROVIDER_BASE_URL`.
 *
 * The value must include the API version segment (e.g. `.../v1`). Trailing
 * slashes are trimmed so callers can safely append `/responses` or
 * `/chat/completions`.
 */
export function getOpenAiBaseUrl(): string {
  return normalizeBaseUrl(readEnv("OPENAI_BASE_URL") || DEFAULT_OPENAI_BASE_URL);
}

export function isAiProviderConfigured() {
  return Boolean(readEnv("OPENROUTER_KEY") || readEnv("OPENAI_API_KEY"));
}

/**
 * Shared config for OpenAI-compatible text generation. `OPENROUTER_KEY` takes
 * precedence over `OPENAI_API_KEY`; when present, it defaults to OpenRouter and
 * adds the required `openai/` namespace to unqualified OpenAI model ids.
 */
export function getOpenAiConfig(): OpenAiConfig | null {
  const openRouterKey = readEnv("OPENROUTER_KEY");
  const openAiKey = readEnv("OPENAI_API_KEY");
  const apiKey = openRouterKey || openAiKey;
  if (!apiKey) {
    return null;
  }

  const providerBaseUrl = readEnv("AI_PROVIDER_BASE_URL");
  const legacyBaseUrl = readEnv("OPENAI_BASE_URL");
  const baseUrl = normalizeBaseUrl(
    providerBaseUrl ||
      legacyBaseUrl ||
      (openRouterKey ? DEFAULT_OPENROUTER_BASE_URL : DEFAULT_OPENAI_BASE_URL),
  );
  const usesOpenRouter = Boolean(openRouterKey) || isOpenRouterBaseUrl(baseUrl);
  const configuredModel = readEnv("OPENAI_MODEL") || "gpt-5.4-mini";
  const model =
    usesOpenRouter && !configuredModel.includes("/")
      ? `openai/${configuredModel}`
      : configuredModel;

  return {
    apiKey,
    model,
    baseUrl,
    provider: usesOpenRouter
      ? "openrouter"
      : baseUrl === DEFAULT_OPENAI_BASE_URL
        ? "openai"
        : "compatible",
  };
}

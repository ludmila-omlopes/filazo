export type AiEstimateConfig = {
  charsPerToken: number;
  inputTokensPerCall: number;
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
};

function readPositiveNumberEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAiEstimateConfig(): AiEstimateConfig {
  return {
    charsPerToken: readPositiveNumberEnv("AI_ESTIMATED_CHARS_PER_TOKEN", 4),
    inputTokensPerCall: readPositiveNumberEnv(
      "AI_ESTIMATED_INPUT_TOKENS_PER_CALL",
      readPositiveNumberEnv("AI_ESTIMATED_INPUT_TOKENS_PER_UNIT", 1500),
    ),
    inputUsdPerMillionTokens: readPositiveNumberEnv(
      "AI_ESTIMATED_INPUT_USD_PER_1M_TOKENS",
      0.15,
    ),
    outputUsdPerMillionTokens: readPositiveNumberEnv(
      "AI_ESTIMATED_OUTPUT_USD_PER_1M_TOKENS",
      0.6,
    ),
  };
}

export function estimateTokensFromText(
  value: string,
  config = getAiEstimateConfig(),
) {
  return Math.max(1, Math.ceil(value.length / config.charsPerToken));
}

export function estimateTokensFromValue(
  value: unknown,
  config = getAiEstimateConfig(),
) {
  return estimateTokensFromText(JSON.stringify(value ?? ""), config);
}

export function estimateAiCostUsd({
  config = getAiEstimateConfig(),
  inputTokens = 0,
  outputTokens = 0,
}: {
  config?: AiEstimateConfig;
  inputTokens?: number;
  outputTokens?: number;
}) {
  return (
    (inputTokens / 1_000_000) * config.inputUsdPerMillionTokens +
    (outputTokens / 1_000_000) * config.outputUsdPerMillionTokens
  );
}

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  getOpenAiConfig,
  isAiProviderConfigured,
} from "./openai.ts";

const env = process.env as Record<string, string | undefined>;
const names = [
  "AI_PROVIDER_BASE_URL",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_MODEL",
  "OPENROUTER_KEY",
];
const originalValues = new Map(names.map((name) => [name, env[name]]));

afterEach(() => {
  for (const [name, value] of originalValues) {
    if (value === undefined) {
      delete env[name];
    } else {
      env[name] = value;
    }
  }
});

function clearAiEnv() {
  for (const name of names) {
    delete env[name];
  }
}

test("uses OpenRouter key, default URL, and routed OpenAI model", () => {
  clearAiEnv();
  env.OPENROUTER_KEY = "openrouter-key";
  env.OPENAI_MODEL = "gpt-5.4-mini";

  assert.deepEqual(getOpenAiConfig(), {
    apiKey: "openrouter-key",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-5.4-mini",
    provider: "openrouter",
  });
});

test("AI_PROVIDER_BASE_URL overrides legacy provider URLs", () => {
  clearAiEnv();
  env.OPENROUTER_KEY = "openrouter-key";
  env.AI_PROVIDER_BASE_URL = "https://gateway.example/v1/";
  env.OPENAI_BASE_URL = "https://legacy.example/v1";
  env.OPENAI_MODEL = "anthropic/claude-sonnet-4.6";

  assert.deepEqual(getOpenAiConfig(), {
    apiKey: "openrouter-key",
    baseUrl: "https://gateway.example/v1",
    model: "anthropic/claude-sonnet-4.6",
    provider: "openrouter",
  });
});

test("keeps direct OpenAI configuration backwards compatible", () => {
  clearAiEnv();
  env.OPENAI_API_KEY = "openai-key";

  assert.deepEqual(getOpenAiConfig(), {
    apiKey: "openai-key",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5.4-mini",
    provider: "openai",
  });
});

test("recognizes either provider key", () => {
  clearAiEnv();
  assert.equal(isAiProviderConfigured(), false);

  env.OPENROUTER_KEY = "openrouter-key";
  assert.equal(isAiProviderConfigured(), true);
});

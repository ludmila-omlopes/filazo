import { BetaTesterStatus, type Prisma } from "@prisma/client";
import {
  reviewBetaApplicationAction,
  updateAiSettingsAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import {
  AI_SETTINGS_FLOAT_LIMITS,
  AI_SETTINGS_LIMITS,
  getAiSettings,
  type AiSettingsValues,
} from "@/lib/ai-settings";
import { getSessionUserWithBeta, isAdminEmail } from "@/lib/beta-access";
import { createTranslator, type Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";

type AdminSearchParams = Promise<{
  aiSettings?: string;
  emailFailed?: string;
  emailSent?: string;
  emailSkipped?: string;
  error?: string;
  reviewed?: string;
}>;

function asStringArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function statusLabel(
  status: BetaTesterStatus,
  t: ReturnType<typeof createTranslator>,
) {
  if (status === BetaTesterStatus.PENDING) {
    return t("admin.status.pending");
  }
  if (status === BetaTesterStatus.APPROVED) {
    return t("admin.status.approved");
  }
  if (status === BetaTesterStatus.REJECTED) {
    return t("admin.status.rejected");
  }
  return t("admin.status.draft");
}

type BooleanAiSettingName =
  | "assistantChatEnabled"
  | "assistantPlayNextEnabled"
  | "assistantSummaryEnabled"
  | "playerProfileEnabled"
  | "photoImportEnabled"
  | "voiceTranscriptionEnabled"
  | "storyCompletionEnabled";

type NumericAiSettingName = keyof typeof AI_SETTINGS_LIMITS;
type FloatAiSettingName = keyof typeof AI_SETTINGS_FLOAT_LIMITS;
type AiNumberFieldName = NumericAiSettingName | FloatAiSettingName;

function localText(
  locale: Locale,
  text: {
    en: string;
    pt: string;
  },
) {
  return locale === "pt-BR" ? text.pt : text.en;
}

const OUTPUT_TOKEN_SETTING_NAMES = [
  "assistantPlayNextMaxOutputTokens",
  "assistantSummaryMaxOutputTokens",
  "chatMaxOutputTokens",
  "photoImportMaxOutputTokens",
  "playerProfileMaxOutputTokens",
  "storyCompletionMaxOutputTokens",
] as const satisfies ReadonlyArray<NumericAiSettingName>;

function readPositiveNumberEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getAiEstimateConfig() {
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

type AiEstimateConfig = ReturnType<typeof getAiEstimateConfig>;

function estimateUsd({
  config,
  inputTokens = 0,
  outputTokens = 0,
}: {
  config: AiEstimateConfig;
  inputTokens?: number;
  outputTokens?: number;
}) {
  return (
    (inputTokens / 1_000_000) * config.inputUsdPerMillionTokens +
    (outputTokens / 1_000_000) * config.outputUsdPerMillionTokens
  );
}

function estimateTokenLimitUsd(tokenLimit: number, config: AiEstimateConfig) {
  const halfTokenLimit = tokenLimit / 2;
  return estimateUsd({
    config,
    inputTokens: halfTokenLimit,
    outputTokens: halfTokenLimit,
  });
}

function estimateCallUsd(outputTokens: number, config: AiEstimateConfig) {
  return estimateUsd({
    config,
    inputTokens: config.inputTokensPerCall,
    outputTokens,
  });
}

function formatUsd(locale: Locale, value: number) {
  return new Intl.NumberFormat(locale, {
    currency: "USD",
    maximumFractionDigits: value < 0.01 ? 4 : 2,
    minimumFractionDigits: value < 0.01 ? 4 : 2,
    style: "currency",
  }).format(value);
}

function formatNumber(locale: Locale, value: number) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBytes(locale: Locale, value: number) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    style: "unit",
    unit: "megabyte",
    unitDisplay: "short",
  }).format(value / (1024 * 1024));
}

function formatMinutes(locale: Locale, value: number) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    style: "unit",
    unit: "minute",
    unitDisplay: "short",
  }).format(value / 60);
}

function getNumericFieldHint({
  config,
  locale,
  name,
  settings,
}: {
  config: AiEstimateConfig;
  locale: Locale;
  name: AiNumberFieldName;
  settings: AiSettingsValues;
}) {
  if (name === "userDailySpendLimitUsd") {
    return localText(locale, {
      en: "Applies across all AI features for each user, including features with no specific limit.",
      pt: "Vale para todos os recursos de IA de cada pessoa, inclusive os recursos sem limite especifico.",
    });
  }

  if (
    name === "chatDailyTokenLimit" ||
    name === "assistantPlayNextDailyTokenLimit"
  ) {
    return localText(locale, {
      en: `Estimated daily ceiling: ${formatUsd(
        locale,
        estimateTokenLimitUsd(settings[name], config),
      )}, about ${formatNumber(
        locale,
        settings[name] * config.charsPerToken,
      )} text characters.`,
      pt: `Teto diario estimado: ${formatUsd(
        locale,
        estimateTokenLimitUsd(settings[name], config),
      )}, cerca de ${formatNumber(
        locale,
        settings[name] * config.charsPerToken,
      )} caracteres de texto.`,
    });
  }

  if (
    (OUTPUT_TOKEN_SETTING_NAMES as ReadonlyArray<NumericAiSettingName>).includes(
      name,
    )
  ) {
    return localText(locale, {
      en: `About ${formatNumber(
        locale,
        settings[name] * config.charsPerToken,
      )} output characters; output cost up to ${formatUsd(
        locale,
        estimateUsd({ config, outputTokens: settings[name] }),
      )}.`,
      pt: `Cerca de ${formatNumber(
        locale,
        settings[name] * config.charsPerToken,
      )} caracteres de resposta; saida ate ${formatUsd(
        locale,
        estimateUsd({ config, outputTokens: settings[name] }),
      )}.`,
    });
  }

  if (name === "playerProfileWeeklyCallLimit") {
    return localText(locale, {
      en: "Default is 2 profile generations per user per week.",
      pt: "O padrao e 2 geracoes de perfil por pessoa por semana.",
    });
  }

  if (name === "photoImportDailyCallLimit") {
    return localText(locale, {
      en: `Each analyzed image counts as one AI call. Estimated cost per call: ${formatUsd(
        locale,
        estimateCallUsd(settings.photoImportMaxOutputTokens, config),
      )}.`,
      pt: `Cada imagem analisada conta como uma chamada de IA. Custo estimado por chamada: ${formatUsd(
        locale,
        estimateCallUsd(settings.photoImportMaxOutputTokens, config),
      )}.`,
    });
  }

  if (name === "photoImportDailyFileLimit") {
    return localText(locale, {
      en: "Daily image count limit per user.",
      pt: "Limite diario de imagens por pessoa.",
    });
  }

  if (name === "voiceTranscriptionDailyCallLimit") {
    return localText(locale, {
      en: `Estimated transcription request cost: ${formatUsd(
        locale,
        estimateCallUsd(0, config),
      )}. Audio billing may differ by model.`,
      pt: `Custo estimado da requisicao de transcricao: ${formatUsd(
        locale,
        estimateCallUsd(0, config),
      )}. A cobranca de audio pode variar por modelo.`,
    });
  }

  if (name === "photoImportMaxFileBytes" || name === "voiceMaxFileBytes") {
    return localText(locale, {
      en: `Equivalent to ${formatBytes(locale, settings[name])}.`,
      pt: `Equivale a ${formatBytes(locale, settings[name])}.`,
    });
  }

  if (name === "voiceRecordingMaxSeconds") {
    return localText(locale, {
      en: `Equivalent to ${formatMinutes(locale, settings[name])}.`,
      pt: `Equivale a ${formatMinutes(locale, settings[name])}.`,
    });
  }

  return null;
}

function getAiNumberFieldLimits(name: AiNumberFieldName) {
  return name === "userDailySpendLimitUsd"
    ? AI_SETTINGS_FLOAT_LIMITS[name]
    : AI_SETTINGS_LIMITS[name];
}

function getAiNumberFieldStep(name: AiNumberFieldName) {
  return name === "userDailySpendLimitUsd" ? 0.01 : 1;
}

// Kept as reference copy for the older settings layout while issue #97 ships.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getAiToggleFields(locale: Locale) {
  return [
    {
      name: "assistantChatEnabled",
      label: localText(locale, {
        en: "Library chat",
        pt: "Chat da biblioteca",
      }),
      description: localText(locale, {
        en: "Streaming assistant in the Assistant tab.",
        pt: "Assistente em streaming na aba Assistente.",
      }),
    },
    {
      name: "assistantPlayNextEnabled",
      label: localText(locale, {
        en: "Play-next recommendations",
        pt: "Recomendacoes do proximo jogo",
      }),
      description: localText(locale, {
        en: "AI ranking for the three play-next picks.",
        pt: "Ranking por IA das tres sugestoes de jogo.",
      }),
    },
    {
      name: "assistantSummaryEnabled",
      label: localText(locale, {
        en: "Assistant summaries",
        pt: "Resumos do assistente",
      }),
      description: localText(locale, {
        en: "Short AI copy over deterministic insights.",
        pt: "Texto curto por IA em cima dos sinais determinísticos.",
      }),
    },
    {
      name: "playerProfileEnabled",
      label: localText(locale, {
        en: "Player profile",
        pt: "Perfil de jogadora",
      }),
      description: localText(locale, {
        en: "Agentic profile generation on the overview tab.",
        pt: "Geracao agentica do perfil na home do perfil.",
      }),
    },
    {
      name: "photoImportEnabled",
      label: localText(locale, {
        en: "Photo catalog import",
        pt: "Importacao por foto",
      }),
      description: localText(locale, {
        en: "Vision extraction from shelf or catalog screenshots.",
        pt: "Extracao por visao de fotos ou screenshots de catalogo.",
      }),
    },
    {
      name: "voiceTranscriptionEnabled",
      label: localText(locale, {
        en: "Voice transcription",
        pt: "Transcricao de voz",
      }),
      description: localText(locale, {
        en: "OpenAI audio transcription for journal voice notes.",
        pt: "Transcricao OpenAI dos audios do diario.",
      }),
    },
    {
      name: "storyCompletionEnabled",
      label: localText(locale, {
        en: "Story achievement AI",
        pt: "IA de trofeu de historia",
      }),
      description: localText(locale, {
        en: "Ambiguous credits-roll achievement classification.",
        pt: "Classificacao ambigua de conquista de fim da historia.",
      }),
    },
  ] satisfies Array<{
    name: BooleanAiSettingName;
    label: string;
    description: string;
  }>;
}

// Kept as reference copy for the older settings layout while issue #97 ships.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getAiNumberGroups(locale: Locale) {
  return [
    {
      title: localText(locale, {
        en: "Personal daily spend",
        pt: "Gasto diario por pessoa",
      }),
      fields: [
        {
          name: "userDailySpendLimitUsd",
          label: localText(locale, {
            en: "Dollar cap per user/day",
            pt: "Teto em dolar por pessoa/dia",
          }),
        },
      ],
    },
    {
      title: localText(locale, { en: "Library chat", pt: "Chat" }),
      fields: [
        {
          name: "chatDailyTokenLimit",
          label: localText(locale, {
            en: "Daily token limit",
            pt: "Limite diario de tokens",
          }),
        },
        {
          name: "chatMaxSteps",
          label: localText(locale, {
            en: "Max model/tool steps",
            pt: "Maximo de steps",
          }),
        },
        {
          name: "chatMaxOutputTokens",
          label: localText(locale, {
            en: "Chat response length",
            pt: "Tamanho da resposta do chat",
          }),
        },
      ],
    },
    {
      title: localText(locale, {
        en: "Assistant refresh",
        pt: "Refresh do assistente",
      }),
      fields: [
        {
          name: "assistantPlayNextDailyTokenLimit",
          label: localText(locale, {
            en: "Play-next daily token limit",
            pt: "Limite diario de tokens das recomendacoes",
          }),
        },
        {
          name: "assistantPlayNextMaxOutputTokens",
          label: localText(locale, {
            en: "Recommendation response length",
            pt: "Tamanho das recomendacoes",
          }),
        },
        {
          name: "assistantSummaryMaxOutputTokens",
          label: localText(locale, {
            en: "Summary response length",
            pt: "Tamanho do resumo",
          }),
        },
      ],
    },
    {
      title: localText(locale, {
        en: "Player profile",
        pt: "Perfil de jogadora",
      }),
      fields: [
        {
          name: "playerProfileWeeklyCallLimit",
          label: localText(locale, {
            en: "Profile generations per week",
            pt: "Geracoes de perfil por semana",
          }),
        },
        {
          name: "playerProfileMaxCalls",
          label: localText(locale, {
            en: "Agent steps per generation",
            pt: "Etapas do agente por geracao",
          }),
        },
        {
          name: "playerProfileMaxOutputTokens",
          label: localText(locale, {
            en: "Profile response length",
            pt: "Tamanho da resposta do perfil",
          }),
        },
      ],
    },
    {
      title: localText(locale, {
        en: "Photo import",
        pt: "Importacao por foto",
      }),
      fields: [
        {
          name: "photoImportDailyCallLimit",
          label: localText(locale, {
            en: "AI calls per day",
            pt: "Chamadas de IA por dia",
          }),
        },
        {
          name: "photoImportDailyFileLimit",
          label: localText(locale, {
            en: "Images per day",
            pt: "Fotos por dia",
          }),
        },
        {
          name: "photoImportMaxFileBytes",
          label: localText(locale, {
            en: "Max image bytes",
            pt: "Maximo de bytes por imagem",
          }),
        },
        {
          name: "photoImportMaxOutputTokens",
          label: localText(locale, {
            en: "Extraction response length",
            pt: "Tamanho da resposta de extracao",
          }),
        },
        {
          name: "photoImportMaxCandidates",
          label: localText(locale, {
            en: "Max extracted games",
            pt: "Maximo de jogos extraidos",
          }),
        },
      ],
    },
    {
      title: localText(locale, {
        en: "Voice journal",
        pt: "Diario por voz",
      }),
      fields: [
        {
          name: "voiceTranscriptionDailyCallLimit",
          label: localText(locale, {
            en: "Transcriptions per day",
            pt: "Transcricoes por dia",
          }),
        },
        {
          name: "voiceMaxFileBytes",
          label: localText(locale, {
            en: "Max audio bytes",
            pt: "Maximo de bytes por audio",
          }),
        },
        {
          name: "voiceRecordingMaxSeconds",
          label: localText(locale, {
            en: "Browser recording seconds",
            pt: "Segundos de gravacao no navegador",
          }),
        },
      ],
    },
    {
      title: localText(locale, {
        en: "Finished-game detection",
        pt: "Deteccao de jogos finalizados",
      }),
      fields: [
        {
          name: "storyCompletionMaxOutputTokens",
          label: localText(locale, {
            en: "Classification response length",
            pt: "Tamanho da resposta de classificacao",
          }),
        },
      ],
    },
  ] satisfies Array<{
    title: string;
    fields: Array<{
      name: AiNumberFieldName;
      label: string;
    }>;
  }>;
}

type AiFeatureCard = {
  advancedFields?: Array<{
    label: string;
    name: AiNumberFieldName;
  }>;
  description: string;
  enabledName?: BooleanAiSettingName;
  governedByCap?: boolean;
  primaryFields?: Array<{
    label: string;
    name: AiNumberFieldName;
  }>;
  title: string;
};

function getAiFeatureCards(locale: Locale) {
  return [
    {
      title: localText(locale, {
        en: "General safety cap",
        pt: "Teto geral de seguranca",
      }),
      description: localText(locale, {
        en: "Top-level estimated dollar guardrail. Every AI feature stops for a user when this daily cap is reached.",
        pt: "Limite geral estimado em dolar. Todos os recursos de IA param para a pessoa quando este teto diario e atingido.",
      }),
      primaryFields: [
        {
          name: "userDailySpendLimitUsd",
          label: localText(locale, {
            en: "Dollar cap per user/day",
            pt: "Teto em dolar por pessoa/dia",
          }),
        },
      ],
    },
    {
      title: localText(locale, { en: "Library chat", pt: "Chat" }),
      enabledName: "assistantChatEnabled",
      description: localText(locale, {
        en: "Streaming chat in the Assistant tab. Raise the daily token limit when chat runs out too early.",
        pt: "Chat em streaming na aba Assistente. Aumente o limite diario de tokens quando o chat acabar cedo demais.",
      }),
      primaryFields: [
        {
          name: "chatDailyTokenLimit",
          label: localText(locale, {
            en: "Daily token limit",
            pt: "Limite diario de tokens",
          }),
        },
      ],
      advancedFields: [
        {
          name: "chatMaxSteps",
          label: localText(locale, {
            en: "Max model/tool steps",
            pt: "Maximo de steps",
          }),
        },
        {
          name: "chatMaxOutputTokens",
          label: localText(locale, {
            en: "Chat response length",
            pt: "Tamanho da resposta do chat",
          }),
        },
      ],
    },
    {
      title: localText(locale, {
        en: "Play-next recommendations",
        pt: "Recomendacoes do proximo jogo",
      }),
      enabledName: "assistantPlayNextEnabled",
      description: localText(locale, {
        en: "AI ranking for three play-next picks. This has its own daily token pool plus the general dollar cap.",
        pt: "Ranking por IA das tres sugestoes de jogo. Tem um limite diario proprio de tokens alem do teto geral em dolar.",
      }),
      primaryFields: [
        {
          name: "assistantPlayNextDailyTokenLimit",
          label: localText(locale, {
            en: "Daily token limit",
            pt: "Limite diario de tokens",
          }),
        },
      ],
      advancedFields: [
        {
          name: "assistantPlayNextMaxOutputTokens",
          label: localText(locale, {
            en: "Recommendation response length",
            pt: "Tamanho das recomendacoes",
          }),
        },
      ],
    },
    {
      title: localText(locale, {
        en: "Assistant summaries",
        pt: "Resumos do assistente",
      }),
      enabledName: "assistantSummaryEnabled",
      governedByCap: true,
      description: localText(locale, {
        en: "Short AI explanations for deterministic assistant insights. No feature-specific budget.",
        pt: "Explicacoes curtas por IA para sinais deterministicos do assistente. Sem limite proprio.",
      }),
      advancedFields: [
        {
          name: "assistantSummaryMaxOutputTokens",
          label: localText(locale, {
            en: "Summary response length",
            pt: "Tamanho do resumo",
          }),
        },
      ],
    },
    {
      title: localText(locale, {
        en: "Player profile",
        pt: "Perfil de jogadora",
      }),
      enabledName: "playerProfileEnabled",
      description: localText(locale, {
        en: "Profile generation is meant to be occasional. The default is 2 generations per user each week.",
        pt: "A geracao de perfil deve ser ocasional. O padrao e 2 geracoes por pessoa a cada semana.",
      }),
      primaryFields: [
        {
          name: "playerProfileWeeklyCallLimit",
          label: localText(locale, {
            en: "Profile generations per week",
            pt: "Geracoes de perfil por semana",
          }),
        },
      ],
      advancedFields: [
        {
          name: "playerProfileMaxCalls",
          label: localText(locale, {
            en: "Agent steps per generation",
            pt: "Etapas do agente por geracao",
          }),
        },
        {
          name: "playerProfileMaxOutputTokens",
          label: localText(locale, {
            en: "Profile response length",
            pt: "Tamanho da resposta do perfil",
          }),
        },
      ],
    },
    {
      title: localText(locale, {
        en: "Photo import",
        pt: "Importacao por foto",
      }),
      enabledName: "photoImportEnabled",
      description: localText(locale, {
        en: "Vision extraction from catalog photos or screenshots. Calls are AI requests; images are uploaded files.",
        pt: "Extracao por visao de fotos ou screenshots de catalogo. Chamadas sao requisicoes de IA; imagens sao arquivos enviados.",
      }),
      primaryFields: [
        {
          name: "photoImportDailyCallLimit",
          label: localText(locale, {
            en: "AI calls per day",
            pt: "Chamadas de IA por dia",
          }),
        },
        {
          name: "photoImportDailyFileLimit",
          label: localText(locale, {
            en: "Images per day",
            pt: "Fotos por dia",
          }),
        },
      ],
      advancedFields: [
        {
          name: "photoImportMaxFileBytes",
          label: localText(locale, {
            en: "Max image bytes",
            pt: "Maximo de bytes por imagem",
          }),
        },
        {
          name: "photoImportMaxOutputTokens",
          label: localText(locale, {
            en: "Extraction response length",
            pt: "Tamanho da resposta de extracao",
          }),
        },
        {
          name: "photoImportMaxCandidates",
          label: localText(locale, {
            en: "Max extracted games",
            pt: "Maximo de jogos extraidos",
          }),
        },
      ],
    },
    {
      title: localText(locale, {
        en: "Voice transcription",
        pt: "Transcricao de voz",
      }),
      enabledName: "voiceTranscriptionEnabled",
      description: localText(locale, {
        en: "Audio transcription for journal voice notes. The daily call limit controls transcriptions; file and recording limits only control upload size.",
        pt: "Transcricao de audio para notas de diario por voz. O limite diario de chamadas controla transcricoes; limites de arquivo e gravacao controlam apenas o tamanho do envio.",
      }),
      primaryFields: [
        {
          name: "voiceTranscriptionDailyCallLimit",
          label: localText(locale, {
            en: "Transcriptions per day",
            pt: "Transcricoes por dia",
          }),
        },
      ],
      advancedFields: [
        {
          name: "voiceMaxFileBytes",
          label: localText(locale, {
            en: "Max audio bytes",
            pt: "Maximo de bytes por audio",
          }),
        },
        {
          name: "voiceRecordingMaxSeconds",
          label: localText(locale, {
            en: "Browser recording seconds",
            pt: "Segundos de gravacao no navegador",
          }),
        },
      ],
    },
    {
      title: localText(locale, {
        en: "Story achievement AI",
        pt: "IA de trofeu de historia",
      }),
      enabledName: "storyCompletionEnabled",
      governedByCap: true,
      description: localText(locale, {
        en: "Classifies ambiguous credits-roll achievements. No feature-specific budget.",
        pt: "Classifica conquistas ambiguas de fim da historia. Sem limite proprio.",
      }),
      advancedFields: [
        {
          name: "storyCompletionMaxOutputTokens",
          label: localText(locale, {
            en: "Classification response length",
            pt: "Tamanho da resposta de classificacao",
          }),
        },
      ],
    },
  ] satisfies AiFeatureCard[];
}

function AiSettingsForm({
  locale,
  settings,
  t,
}: {
  locale: Locale;
  settings: AiSettingsValues;
  t: ReturnType<typeof createTranslator>;
}) {
  const estimateConfig = getAiEstimateConfig();
  const chatDailyCost = estimateTokenLimitUsd(
    settings.chatDailyTokenLimit,
    estimateConfig,
  );
  const playNextDailyCost = estimateTokenLimitUsd(
    settings.assistantPlayNextDailyTokenLimit,
    estimateConfig,
  );
  const renderNumberField = (field: {
    label: string;
    name: AiNumberFieldName;
  }) => {
    const limits = getAiNumberFieldLimits(field.name);
    const hint = getNumericFieldHint({
      config: estimateConfig,
      locale,
      name: field.name,
      settings,
    });

    return (
      <label className="grid gap-1.5" key={field.name}>
        <span className="text-sm font-semibold">{field.label}</span>
        <input
          className="min-h-11 rounded-inner border border-edge bg-canvas px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow"
          defaultValue={settings[field.name]}
          max={limits.max}
          min={limits.min}
          name={field.name}
          step={getAiNumberFieldStep(field.name)}
          type="number"
        />
        <span className="text-[0.7rem] font-semibold text-ink-soft">
          {limits.min} - {limits.max}
        </span>
        {hint ? (
          <span className="text-xs leading-relaxed text-ink-soft">
            {hint}
          </span>
        ) : null}
      </label>
    );
  };

  return (
    <Card tactile>
      <CardContent className="grid gap-6 p-6">
        <div>
          <p className="text-kicker font-bold uppercase text-ink-soft">
            {t("admin.ai.kicker")}
          </p>
          <h2 className="mt-1 font-display text-2xl font-medium">
            {t("admin.ai.title")}
          </h2>
          <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-ink-soft">
            {t("admin.ai.body")}
          </p>
        </div>

        <form action={updateAiSettingsAction} className="grid gap-6">
          <input name="userDailyLimit" type="hidden" value={settings.userDailyLimit} />
          <input name="globalDailyLimit" type="hidden" value={settings.globalDailyLimit} />
          <input name="chatBudgetUnits" type="hidden" value={settings.chatBudgetUnits} />
          <input name="photoImportMaxFiles" type="hidden" value={settings.photoImportMaxFiles} />
          <input
            name="storyCompletionMaxClassificationsPerRun"
            type="hidden"
            value={settings.storyCompletionMaxClassificationsPerRun}
          />
          <input
            name="voiceTranslationMaxOutputTokens"
            type="hidden"
            value={settings.voiceTranslationMaxOutputTokens}
          />

          <div className="grid gap-3 rounded-inner border border-edge bg-surface p-4">
            <div>
              <p className="text-sm font-bold text-ink">
                {localText(locale, {
                  en: "Dollar estimate",
                  pt: "Estimativa em dolar",
                })}
              </p>
              <p className="mt-1 max-w-[78ch] text-xs leading-relaxed text-ink-soft">
                {localText(locale, {
                  en: "The app enforces feature-specific limits and a daily dollar cap per person. Dollar values are estimates; actual invoices depend on provider pricing, prompt size, tools, audio billing, and cached tokens.",
                  pt: "O app aplica limites por funcionalidade e um teto diario em dolar por pessoa. Os valores em dolar sao estimativas; a fatura real depende do preco do provedor, tamanho do prompt, ferramentas, cobranca de audio e tokens em cache.",
                })}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm max-md:grid-cols-1">
              <div className="rounded-inner border border-edge bg-canvas p-3">
                <p className="text-xs font-bold uppercase text-ink-soft">
                  {localText(locale, { en: "Per person/day", pt: "Por pessoa/dia" })}
                </p>
                <p className="mt-1 font-display text-2xl">
                  {formatUsd(locale, settings.userDailySpendLimitUsd)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  {localText(locale, {
                    en: "General daily spend cap.",
                    pt: "Teto geral diario de gasto.",
                  })}
                </p>
              </div>
              <div className="rounded-inner border border-edge bg-canvas p-3">
                <p className="text-xs font-bold uppercase text-ink-soft">
                  {localText(locale, { en: "Chat/day", pt: "Chat/dia" })}
                </p>
                <p className="mt-1 font-display text-2xl">
                  {formatNumber(locale, settings.chatDailyTokenLimit)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  {formatUsd(locale, chatDailyCost)}{" "}
                  {localText(locale, {
                    en: "estimated.",
                    pt: "estimados.",
                  })}
                </p>
              </div>
              <div className="rounded-inner border border-edge bg-canvas p-3">
                <p className="text-xs font-bold uppercase text-ink-soft">
                  {localText(locale, { en: "Next picks/day", pt: "Proximos jogos/dia" })}
                </p>
                <p className="mt-1 font-display text-2xl">
                  {formatNumber(
                    locale,
                    settings.assistantPlayNextDailyTokenLimit,
                  )}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  {formatUsd(locale, playNextDailyCost)}{" "}
                  {localText(locale, {
                    en: "estimated.",
                    pt: "estimados.",
                  })}
                </p>
              </div>
            </div>
            <p className="text-[0.7rem] font-semibold text-ink-soft">
              {localText(locale, {
                en: `Price basis: ${formatUsd(
                  locale,
                  estimateConfig.inputUsdPerMillionTokens,
                )}/1M input tokens, ${formatUsd(
                  locale,
                  estimateConfig.outputUsdPerMillionTokens,
                )}/1M output tokens, ${formatNumber(
                  locale,
                  estimateConfig.charsPerToken,
                )} chars/token.`,
                pt: `Base: ${formatUsd(
                  locale,
                  estimateConfig.inputUsdPerMillionTokens,
                )}/1M tokens de entrada, ${formatUsd(
                  locale,
                  estimateConfig.outputUsdPerMillionTokens,
                )}/1M tokens de saida, ${formatNumber(
                  locale,
                  estimateConfig.charsPerToken,
                )} caracteres/token.`,
              })}
            </p>
          </div>

          <div className="grid gap-4">
            {getAiFeatureCards(locale).map((feature) => (
              <section
                className="grid gap-4 rounded-inner border border-edge bg-surface p-4"
                key={feature.title}
              >
                <div className="flex items-start justify-between gap-4 max-sm:grid">
                  <div>
                    <h3 className="text-base font-bold text-ink">
                      {feature.title}
                    </h3>
                    <p className="mt-1 max-w-[78ch] text-sm leading-relaxed text-ink-soft">
                      {feature.description}
                    </p>
                    {feature.governedByCap ? (
                      <p className="mt-2 text-xs font-bold uppercase text-ink-soft">
                        {localText(locale, {
                          en: "Governed by the general per-user daily dollar cap",
                          pt: "Governado pelo teto geral diario em dolar por pessoa",
                        })}
                      </p>
                    ) : null}
                  </div>
                  {feature.enabledName ? (
                    <label className="flex shrink-0 items-center gap-2 rounded-inner border border-edge bg-canvas px-3 py-2 text-sm font-bold">
                      <input
                        className="h-4 w-4 accent-ink"
                        defaultChecked={settings[feature.enabledName]}
                        name={feature.enabledName}
                        type="checkbox"
                      />
                      {localText(locale, { en: "Enabled", pt: "Ativo" })}
                    </label>
                  ) : null}
                </div>

                {feature.primaryFields?.length ? (
                  <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                    {feature.primaryFields.map(renderNumberField)}
                  </div>
                ) : null}

                {feature.advancedFields?.length ? (
                  <div className="grid gap-3 border-t border-edge pt-3">
                    <p className="text-xs font-bold uppercase text-ink-soft">
                      {localText(locale, {
                        en: "Advanced technical controls",
                        pt: "Controles tecnicos avancados",
                      })}
                    </p>
                    <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                      {feature.advancedFields.map(renderNumberField)}
                    </div>
                  </div>
                ) : null}
              </section>
            ))}
          </div>

          <Button className="justify-self-start" type="submit">
            {t("admin.ai.save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default async function AdminPage({
  searchParams,
}: PageProps<"/admin"> & { searchParams: AdminSearchParams }) {
  const locale: Locale = await getRequestLocale();
  const t = createTranslator(locale);
  const query = await searchParams;
  const admin = await getSessionUserWithBeta(await getSessionUserId());

  if (!admin || !isAdminEmail(admin.email)) {
    return (
      <main id="main-content" className="mx-auto grid w-full max-w-[860px] gap-6">
        <Notice tone="error">{t("admin.restricted")}</Notice>
        <Button asChild className="w-fit">
          <a href="/api/auth/youtube?next=/admin">{t("admin.signInGoogle")}</a>
        </Button>
      </main>
    );
  }

  const [applications, aiSettings] = await Promise.all([
    prisma.betaTesterApplication.findMany({
      where: {
        status: { not: BetaTesterStatus.DRAFT },
      },
      include: {
        user: true,
        reviewedBy: true,
      },
      orderBy: [
        { status: "desc" },
        { createdAt: "asc" },
      ],
    }),
    getAiSettings(),
  ]);

  const pendingCount = applications.filter(
    (application) => application.status === BetaTesterStatus.PENDING,
  ).length;
  const approvedApplications = applications.filter(
    (application) => application.status === BetaTesterStatus.APPROVED,
  );

  return (
    <main id="main-content" className="mx-auto grid w-full max-w-[1100px] gap-8">
      {query.error ? <Notice tone="error">{query.error}</Notice> : null}
      {query.reviewed ? (
        <Notice tone="success">{t("admin.reviewed")}</Notice>
      ) : null}
      {query.emailSent ? (
        <Notice tone="success">{t("admin.email.sent")}</Notice>
      ) : null}
      {query.emailSkipped ? (
        <Notice tone="info">{t("admin.email.skipped")}</Notice>
      ) : null}
      {query.emailFailed ? (
        <Notice tone="error">{t("admin.email.failed")}</Notice>
      ) : null}
      {query.aiSettings ? (
        <Notice tone="success">{t("admin.ai.saved")}</Notice>
      ) : null}

      <section className="grid gap-3">
        <p className="text-kicker font-bold uppercase text-ink-soft">
          {t("admin.kicker")}
        </p>
        <h1 className="text-page-title">{t("admin.title")}</h1>
        <p className="max-w-[62ch] text-ink-soft">
          {t("admin.body")}
        </p>
      </section>

      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <Card tactile>
          <CardContent className="p-5">
            <p className="text-sm font-bold text-ink-soft">
              {t("admin.pending")}
            </p>
            <p className="mt-2 font-display text-4xl">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card tactile>
          <CardContent className="p-5">
            <p className="text-sm font-bold text-ink-soft">
              {t("admin.totalReviewable")}
            </p>
            <p className="mt-2 font-display text-4xl">{applications.length}</p>
          </CardContent>
        </Card>
        <Card tactile>
          <CardContent className="p-5">
            <p className="text-sm font-bold text-ink-soft">{t("admin.kicker")}</p>
            <p className="mt-2 truncate font-semibold">{admin.email}</p>
          </CardContent>
        </Card>
      </div>

      <Card tactile>
        <CardContent className="grid gap-4 p-6">
          <div>
            <p className="text-kicker font-bold uppercase text-ink-soft">
              {t("admin.approvedEmails.kicker")}
            </p>
            <h2 className="mt-1 font-display text-2xl font-medium">
              {t("admin.approvedEmails.title")}
            </h2>
          </div>
          {approvedApplications.length ? (
            <div className="grid gap-2">
              {approvedApplications.map((application) => {
                const email = application.user.email;

                return (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-inner border border-edge bg-surface px-4 py-3"
                    key={application.id}
                  >
                    <span className="font-semibold">
                      {application.name ??
                        application.user.displayName ??
                        t("admin.noName")}
                    </span>
                    {email ? (
                      <a
                        className="break-all text-sm font-bold text-ink underline decoration-ink/30 underline-offset-4"
                        href={`mailto:${email}`}
                      >
                        {email}
                      </a>
                    ) : (
                      <span className="text-sm text-ink-soft">
                        {t("admin.noEmail")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm font-semibold text-ink-soft">
              {t("admin.approvedEmails.empty")}
            </p>
          )}
        </CardContent>
      </Card>

      <AiSettingsForm locale={locale} settings={aiSettings} t={t} />

      <section className="grid gap-4">
        {applications.length ? (
          applications.map((application) => {
            const platforms = asStringArray(application.platforms);
            const isPending = application.status === BetaTesterStatus.PENDING;

            return (
              <Card tactile key={application.id}>
                <CardContent className="grid gap-5 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-kicker font-bold uppercase text-ink-soft">
                        {statusLabel(application.status, t)}
                      </p>
                      <h2 className="mt-1 font-display text-2xl font-medium">
                        {application.name ??
                          application.user.displayName ??
                          t("admin.noName")}
                      </h2>
                      <p className="mt-1 text-sm text-ink-soft">
                        {application.user.email ?? t("admin.noEmail")}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-ink-soft">
                      {application.createdAt.toLocaleDateString(locale)}
                    </p>
                  </div>

                  <div className="grid gap-2 text-sm text-ink">
                    <p>
                      <strong>{t("admin.platforms")}:</strong>{" "}
                      {platforms.length
                        ? platforms.join(", ")
                        : t("admin.notInformed")}
                    </p>
                    <p>
                      <strong>{t("admin.retrogames")}:</strong>{" "}
                      {application.retroGames || t("admin.notInformed")}
                    </p>
                    {application.justification ? (
                      <p>
                        <strong>{t("admin.justification")}:</strong>{" "}
                        {application.justification}
                      </p>
                    ) : null}
                    {application.accessExpiresAt ? (
                      <p>
                        <strong>{t("admin.accessUntil")}:</strong>{" "}
                        {application.accessExpiresAt.toLocaleDateString(locale)}
                      </p>
                    ) : null}
                  </div>

                  {isPending ? (
                    <form
                      action={reviewBetaApplicationAction}
                      className="grid gap-3"
                    >
                      <input
                        name="applicationId"
                        type="hidden"
                        value={application.id}
                      />
                      <label className="grid gap-2">
                        <span className="text-sm font-bold text-ink">
                          {t("admin.justification")}
                        </span>
                        <textarea
                          className="min-h-24 rounded-inner border border-edge bg-surface px-4 py-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow"
                          maxLength={500}
                          name="justification"
                          required
                        />
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <Button name="decision" type="submit" value="approve">
                          {t("admin.approve")}
                        </Button>
                        <Button
                          name="decision"
                          type="submit"
                          value="reject"
                          variant="outline"
                        >
                          {t("admin.reject")}
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card tactile>
            <CardContent className="p-6">
              <p className="font-semibold">{t("admin.empty")}</p>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}

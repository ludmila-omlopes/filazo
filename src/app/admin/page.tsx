import { BetaTesterStatus, type Prisma } from "@prisma/client";
import {
  reviewBetaApplicationAction,
  updateAiSettingsAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import {
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
  | "voiceTranslationEnabled"
  | "storyCompletionEnabled";

type NumericAiSettingName = keyof typeof AI_SETTINGS_LIMITS;

function localText(
  locale: Locale,
  text: {
    en: string;
    pt: string;
  },
) {
  return locale === "pt-BR" ? text.pt : text.en;
}

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
      name: "voiceTranslationEnabled",
      label: localText(locale, {
        en: "Transcript translation",
        pt: "Traducao de transcricoes",
      }),
      description: localText(locale, {
        en: "Optional translation after a transcript is created.",
        pt: "Traducao opcional depois da transcricao.",
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

function getAiNumberGroups(locale: Locale) {
  return [
    {
      title: localText(locale, { en: "Daily budget", pt: "Orcamento diario" }),
      fields: [
        {
          name: "userDailyLimit",
          label: localText(locale, {
            en: "Per-user daily units",
            pt: "Unidades diarias por pessoa",
          }),
        },
        {
          name: "globalDailyLimit",
          label: localText(locale, {
            en: "App-wide daily units",
            pt: "Unidades diarias globais",
          }),
        },
      ],
    },
    {
      title: localText(locale, { en: "Library chat", pt: "Chat" }),
      fields: [
        {
          name: "chatBudgetUnits",
          label: localText(locale, {
            en: "Budget units per exchange",
            pt: "Unidades por mensagem",
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
            en: "Max output tokens",
            pt: "Maximo de tokens de saida",
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
          name: "assistantPlayNextMaxOutputTokens",
          label: localText(locale, {
            en: "Play-next output tokens",
            pt: "Tokens das recomendacoes",
          }),
        },
        {
          name: "assistantSummaryMaxOutputTokens",
          label: localText(locale, {
            en: "Summary output tokens",
            pt: "Tokens do resumo",
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
          name: "playerProfileMaxCalls",
          label: localText(locale, {
            en: "Max model calls",
            pt: "Maximo de chamadas",
          }),
        },
        {
          name: "playerProfileMaxOutputTokens",
          label: localText(locale, {
            en: "Max output tokens",
            pt: "Maximo de tokens de saida",
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
          name: "photoImportMaxFiles",
          label: localText(locale, {
            en: "Max images per import",
            pt: "Maximo de imagens por importacao",
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
            en: "Max output tokens",
            pt: "Maximo de tokens de saida",
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
        {
          name: "voiceTranslationMaxOutputTokens",
          label: localText(locale, {
            en: "Translation output tokens",
            pt: "Tokens de traducao",
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
          name: "storyCompletionMaxClassificationsPerRun",
          label: localText(locale, {
            en: "Max AI classifications per run",
            pt: "Maximo de classificacoes por execucao",
          }),
        },
        {
          name: "storyCompletionMaxOutputTokens",
          label: localText(locale, {
            en: "Max output tokens",
            pt: "Maximo de tokens de saida",
          }),
        },
      ],
    },
  ] satisfies Array<{
    title: string;
    fields: Array<{
      name: NumericAiSettingName;
      label: string;
    }>;
  }>;
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
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            {getAiToggleFields(locale).map((field) => (
              <label
                className="flex gap-3 rounded-inner border border-edge bg-canvas/70 p-3"
                key={field.name}
              >
                <input
                  className="mt-1 h-4 w-4 accent-ink"
                  defaultChecked={settings[field.name]}
                  name={field.name}
                  type="checkbox"
                />
                <span>
                  <span className="block text-sm font-bold text-ink">
                    {field.label}
                  </span>
                  <span className="block text-xs leading-relaxed text-ink-soft">
                    {field.description}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="grid gap-4">
            {getAiNumberGroups(locale).map((group) => (
              <fieldset
                className="grid gap-3 rounded-inner border border-edge bg-surface p-4"
                key={group.title}
              >
                <legend className="px-1 text-sm font-bold text-ink-soft">
                  {group.title}
                </legend>
                <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                  {group.fields.map((field) => {
                    const limits = AI_SETTINGS_LIMITS[field.name];
                    return (
                      <label className="grid gap-1.5" key={field.name}>
                        <span className="text-sm font-semibold">
                          {field.label}
                        </span>
                        <input
                          className="min-h-11 rounded-inner border border-edge bg-canvas px-3 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow"
                          defaultValue={settings[field.name]}
                          max={limits.max}
                          min={limits.min}
                          name={field.name}
                          step={1}
                          type="number"
                        />
                        <span className="text-[0.7rem] font-semibold text-ink-soft">
                          {limits.min} - {limits.max}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
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
          <a href="/api/auth/youtube">{t("admin.signInGoogle")}</a>
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

  return (
    <main id="main-content" className="mx-auto grid w-full max-w-[1100px] gap-8">
      {query.error ? <Notice tone="error">{query.error}</Notice> : null}
      {query.reviewed ? (
        <Notice tone="success">{t("admin.reviewed")}</Notice>
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

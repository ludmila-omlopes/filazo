"use server";

import { BetaTesterStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  getSessionUserWithBeta,
  isAdminEmail,
  oneYearFromNow,
} from "@/lib/beta-access";
import {
  AI_SETTINGS_FLOAT_LIMITS,
  AI_SETTINGS_LIMITS,
  saveAiSettings,
  type AiSettingsValues,
} from "@/lib/ai-settings";
import { sendBetaApprovalEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { getRequestTranslator } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";

const reviewSchema = z.object({
  applicationId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  justification: z.string().trim().min(3).max(500),
});

function intSettingSchema(key: keyof typeof AI_SETTINGS_LIMITS) {
  const limits = AI_SETTINGS_LIMITS[key];
  return z.coerce.number().int().min(limits.min).max(limits.max);
}

function floatSettingSchema(key: keyof typeof AI_SETTINGS_FLOAT_LIMITS) {
  const limits = AI_SETTINGS_FLOAT_LIMITS[key];
  return z.coerce.number().min(limits.min).max(limits.max);
}

const aiSettingsSchema = z.object({
  assistantChatEnabled: z.boolean(),
  assistantPlayNextEnabled: z.boolean(),
  assistantSummaryEnabled: z.boolean(),
  playerProfileEnabled: z.boolean(),
  photoImportEnabled: z.boolean(),
  voiceTranscriptionEnabled: z.boolean(),
  voiceTranslationEnabled: z.boolean(),
  storyCompletionEnabled: z.boolean(),
  userDailySpendLimitUsd: floatSettingSchema("userDailySpendLimitUsd"),
  chatDailyTokenLimit: intSettingSchema("chatDailyTokenLimit"),
  assistantPlayNextDailyTokenLimit: intSettingSchema(
    "assistantPlayNextDailyTokenLimit",
  ),
  playerProfileWeeklyCallLimit: intSettingSchema(
    "playerProfileWeeklyCallLimit",
  ),
  photoImportDailyCallLimit: intSettingSchema("photoImportDailyCallLimit"),
  photoImportDailyFileLimit: intSettingSchema("photoImportDailyFileLimit"),
  voiceTranscriptionDailyCallLimit: intSettingSchema(
    "voiceTranscriptionDailyCallLimit",
  ),
  userDailyLimit: intSettingSchema("userDailyLimit"),
  globalDailyLimit: intSettingSchema("globalDailyLimit"),
  chatBudgetUnits: intSettingSchema("chatBudgetUnits"),
  chatMaxSteps: intSettingSchema("chatMaxSteps"),
  chatMaxOutputTokens: intSettingSchema("chatMaxOutputTokens"),
  assistantPlayNextMaxOutputTokens: intSettingSchema(
    "assistantPlayNextMaxOutputTokens",
  ),
  assistantSummaryMaxOutputTokens: intSettingSchema(
    "assistantSummaryMaxOutputTokens",
  ),
  playerProfileMaxCalls: intSettingSchema("playerProfileMaxCalls"),
  playerProfileMaxOutputTokens: intSettingSchema(
    "playerProfileMaxOutputTokens",
  ),
  photoImportMaxFiles: intSettingSchema("photoImportMaxFiles"),
  photoImportMaxFileBytes: intSettingSchema("photoImportMaxFileBytes"),
  photoImportMaxOutputTokens: intSettingSchema("photoImportMaxOutputTokens"),
  photoImportMaxCandidates: intSettingSchema("photoImportMaxCandidates"),
  voiceMaxFileBytes: intSettingSchema("voiceMaxFileBytes"),
  voiceRecordingMaxSeconds: intSettingSchema("voiceRecordingMaxSeconds"),
  voiceTranslationMaxOutputTokens: intSettingSchema(
    "voiceTranslationMaxOutputTokens",
  ),
  storyCompletionMaxClassificationsPerRun: intSettingSchema(
    "storyCompletionMaxClassificationsPerRun",
  ),
  storyCompletionMaxOutputTokens: intSettingSchema(
    "storyCompletionMaxOutputTokens",
  ),
}) satisfies z.ZodType<AiSettingsValues>;

function readCheckbox(formData: FormData, name: keyof AiSettingsValues) {
  return formData.get(name) === "on";
}

async function requireAdmin() {
  const user = await getSessionUserWithBeta(await getSessionUserId());
  if (!user || !isAdminEmail(user.email)) {
    redirect("/beta");
  }

  return user;
}

export async function reviewBetaApplicationAction(formData: FormData) {
  const { t } = await getRequestTranslator();
  const admin = await requireAdmin();
  const parsed = reviewSchema.safeParse({
    applicationId: formData.get("applicationId"),
    decision: formData.get("decision"),
    justification: formData.get("justification"),
  });

  if (!parsed.success) {
    redirect(
      `/admin?error=${encodeURIComponent(
        t("admin.error.justificationRequired"),
      )}`,
    );
  }

  const application = await prisma.betaTesterApplication.update({
    where: { id: parsed.data.applicationId },
    data: {
      status:
        parsed.data.decision === "approve"
          ? BetaTesterStatus.APPROVED
          : BetaTesterStatus.REJECTED,
      justification: parsed.data.justification,
      reviewedById: admin.id,
      reviewedAt: new Date(),
      accessExpiresAt:
        parsed.data.decision === "approve" ? oneYearFromNow() : null,
    },
    include: {
      user: true,
    },
  });
  const redirectParams = new URLSearchParams({ reviewed: "1" });

  if (
    parsed.data.decision === "approve" &&
    application.user.email
  ) {
    try {
      const result = await sendBetaApprovalEmail({
        to: application.user.email,
        recipientName:
          application.name ??
          application.user.displayName ??
          application.user.email.split("@")[0],
      });
      redirectParams.set(
        result.sent ? "emailSent" : "emailSkipped",
        "1",
      );
    } catch (error) {
      redirectParams.set("emailFailed", "1");
      console.error("Failed to send beta approval email.", {
        applicationId: application.id,
        userId: application.userId,
        error,
      });
    }
  } else if (parsed.data.decision === "approve") {
    redirectParams.set("emailSkipped", "1");
  }

  revalidatePath("/admin");
  revalidatePath("/beta");
  redirect(`/admin?${redirectParams.toString()}`);
}

export async function updateAiSettingsAction(formData: FormData) {
  const { t } = await getRequestTranslator();
  await requireAdmin();

  const parsed = aiSettingsSchema.safeParse({
    assistantChatEnabled: readCheckbox(formData, "assistantChatEnabled"),
    assistantPlayNextEnabled: readCheckbox(
      formData,
      "assistantPlayNextEnabled",
    ),
    assistantSummaryEnabled: readCheckbox(
      formData,
      "assistantSummaryEnabled",
    ),
    playerProfileEnabled: readCheckbox(formData, "playerProfileEnabled"),
    photoImportEnabled: readCheckbox(formData, "photoImportEnabled"),
    voiceTranscriptionEnabled: readCheckbox(
      formData,
      "voiceTranscriptionEnabled",
    ),
    voiceTranslationEnabled: readCheckbox(
      formData,
      "voiceTranslationEnabled",
    ),
    storyCompletionEnabled: readCheckbox(
      formData,
      "storyCompletionEnabled",
    ),
    userDailySpendLimitUsd: formData.get("userDailySpendLimitUsd"),
    chatDailyTokenLimit: formData.get("chatDailyTokenLimit"),
    assistantPlayNextDailyTokenLimit: formData.get(
      "assistantPlayNextDailyTokenLimit",
    ),
    playerProfileWeeklyCallLimit: formData.get(
      "playerProfileWeeklyCallLimit",
    ),
    photoImportDailyCallLimit: formData.get("photoImportDailyCallLimit"),
    photoImportDailyFileLimit: formData.get("photoImportDailyFileLimit"),
    voiceTranscriptionDailyCallLimit: formData.get(
      "voiceTranscriptionDailyCallLimit",
    ),
    userDailyLimit: formData.get("userDailyLimit"),
    globalDailyLimit: formData.get("globalDailyLimit"),
    chatBudgetUnits: formData.get("chatBudgetUnits"),
    chatMaxSteps: formData.get("chatMaxSteps"),
    chatMaxOutputTokens: formData.get("chatMaxOutputTokens"),
    assistantPlayNextMaxOutputTokens: formData.get(
      "assistantPlayNextMaxOutputTokens",
    ),
    assistantSummaryMaxOutputTokens: formData.get(
      "assistantSummaryMaxOutputTokens",
    ),
    playerProfileMaxCalls: formData.get("playerProfileMaxCalls"),
    playerProfileMaxOutputTokens: formData.get(
      "playerProfileMaxOutputTokens",
    ),
    photoImportMaxFiles: formData.get("photoImportMaxFiles"),
    photoImportMaxFileBytes: formData.get("photoImportMaxFileBytes"),
    photoImportMaxOutputTokens: formData.get("photoImportMaxOutputTokens"),
    photoImportMaxCandidates: formData.get("photoImportMaxCandidates"),
    voiceMaxFileBytes: formData.get("voiceMaxFileBytes"),
    voiceRecordingMaxSeconds: formData.get("voiceRecordingMaxSeconds"),
    voiceTranslationMaxOutputTokens: formData.get(
      "voiceTranslationMaxOutputTokens",
    ),
    storyCompletionMaxClassificationsPerRun: formData.get(
      "storyCompletionMaxClassificationsPerRun",
    ),
    storyCompletionMaxOutputTokens: formData.get(
      "storyCompletionMaxOutputTokens",
    ),
  });

  if (!parsed.success) {
    redirect(
      `/admin?error=${encodeURIComponent(t("admin.ai.invalidSettings"))}`,
    );
  }

  await saveAiSettings(parsed.data);

  revalidatePath("/admin");
  revalidatePath("/profile");
  redirect("/admin?aiSettings=1");
}

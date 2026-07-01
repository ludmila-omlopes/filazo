"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { refreshAssistantInsightsForUser } from "@/lib/assistant/queries";
import {
  generatePlayerProfile,
  savePlayerProfile,
} from "@/lib/assistant/profile-agent";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { createTranslator } from "@/lib/i18n";
import { getSessionUserId } from "@/lib/session";

const updateIntentSchema = z.object({
  entryId: z.string().min(1),
  userIntent: z.string().max(240).optional(),
  desiredSessionMin: z.coerce.number().int().min(5).max(240).optional(),
  activeBacklog: z.enum(["true", "false"]).optional(),
});

const abandonReasonSchema = z.object({
  entryId: z.string().min(1),
  abandonReason: z.string().max(500).optional(),
});

export async function refreshAssistantInsightsAction() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/profile?tab=assistant&error=${encodeURIComponent(t("assistantAction.needRefreshLogin"))}`);
  }

  let insightCount = 0;
  try {
    const result = await refreshAssistantInsightsForUser(userId);
    insightCount = result.insightCount;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t("assistantAction.refreshFailed");
    redirect(`/profile?tab=assistant&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  redirect(`/profile?tab=assistant&assistant=${insightCount}`);
}

export async function generatePlayerProfileAction() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/profile?tab=player-profile&error=${encodeURIComponent(t("assistantAction.needProfileLogin"))}`);
  }

  let result: Awaited<ReturnType<typeof generatePlayerProfile>>;
  try {
    result = await generatePlayerProfile(userId, locale);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : t("assistantAction.profileFailed");
    redirect(`/profile?tab=player-profile&error=${encodeURIComponent(message)}`);
  }

  if (result.status === "EMPTY") {
    redirect("/profile?tab=player-profile&playerProfile=empty");
  }

  await savePlayerProfile(userId, result);
  revalidatePath("/profile");
  redirect("/profile?tab=player-profile&playerProfile=updated");
}

export async function updateGameIntentAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    return;
  }

  const parsed = updateIntentSchema.safeParse({
    entryId: formData.get("entryId"),
    userIntent: formData.get("userIntent") || undefined,
    desiredSessionMin: formData.get("desiredSessionMin") || undefined,
    activeBacklog: formData.get("activeBacklog") || undefined,
  });

  if (!parsed.success) {
    return;
  }

  const entry = await prisma.userGameEntry.findUnique({
    where: { id: parsed.data.entryId },
  });
  if (!entry || entry.userId !== userId) {
    return;
  }

  await prisma.userGameEntry.update({
    where: { id: entry.id },
    data: {
      userIntent: parsed.data.userIntent,
      desiredSessionMin: parsed.data.desiredSessionMin,
      activeBacklog:
        parsed.data.activeBacklog === undefined
          ? undefined
          : parsed.data.activeBacklog === "true",
    },
  });

  revalidatePath("/profile");
}

export async function saveAbandonReasonAction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    return;
  }

  const parsed = abandonReasonSchema.safeParse({
    entryId: formData.get("entryId"),
    abandonReason: formData.get("abandonReason") || undefined,
  });

  if (!parsed.success) {
    return;
  }

  const entry = await prisma.userGameEntry.findUnique({
    where: { id: parsed.data.entryId },
  });
  if (!entry || entry.userId !== userId) {
    return;
  }

  await prisma.userGameEntry.update({
    where: { id: entry.id },
    data: {
      abandonReason: parsed.data.abandonReason,
      abandonedAt: parsed.data.abandonReason ? new Date() : null,
    },
  });

  revalidatePath("/profile");
}

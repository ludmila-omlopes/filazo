"use server";

import { FeedbackType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestTranslator } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";

const feedbackSchema = z.object({
  type: z.nativeEnum(FeedbackType),
  title: z.string().trim().min(3).max(120),
  details: z.string().trim().min(10).max(2000),
});

export async function submitFeedbackAction(formData: FormData) {
  const { t } = await getRequestTranslator();
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/feedback");
  }

  const parsed = feedbackSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    details: formData.get("details"),
  });

  if (!parsed.success) {
    redirect(
      `/feedback?error=${encodeURIComponent(t("feedback.error.invalid"))}`,
    );
  }

  await prisma.feedback.create({
    data: {
      userId,
      type: parsed.data.type,
      title: parsed.data.title,
      details: parsed.data.details,
    },
  });

  revalidatePath("/feedback");
  revalidatePath("/admin/feedback");
  redirect("/feedback?sent=1");
}

"use server";

import { FeedbackType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ADMIN_EMAIL } from "@/lib/beta-access";
import { sendFeedbackCommentEmail } from "@/lib/email";
import { isFeedbackClosed } from "@/lib/feedback";
import { getRequestTranslator } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";

const feedbackSchema = z.object({
  type: z.nativeEnum(FeedbackType),
  title: z.string().trim().min(3).max(120),
  details: z.string().trim().min(10).max(2000),
});

const feedbackCommentSchema = z.object({
  feedbackId: z.string().min(1),
  body: z.string().trim().min(1).max(2000),
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

export async function submitFeedbackCommentAction(formData: FormData) {
  const { t } = await getRequestTranslator();
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/feedback");
  }

  const parsed = feedbackCommentSchema.safeParse({
    feedbackId: formData.get("feedbackId"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    redirect(
      `/feedback?error=${encodeURIComponent(
        t("feedback.error.commentInvalid"),
      )}`,
    );
  }

  const feedback = await prisma.feedback.findFirst({
    where: { id: parsed.data.feedbackId, userId },
    include: { user: { select: { displayName: true, email: true } } },
  });

  if (!feedback || isFeedbackClosed(feedback.status)) {
    redirect(
      `/feedback?error=${encodeURIComponent(
        t("feedback.error.commentClosed"),
      )}`,
    );
  }

  await prisma.feedbackComment.create({
    data: {
      feedbackId: feedback.id,
      authorUserId: userId,
      body: parsed.data.body,
    },
  });

  const query = new URLSearchParams({ commentSent: "1" });
  try {
    const result = await sendFeedbackCommentEmail({
      to: ADMIN_EMAIL,
      recipientName: "Ludmila",
      title: feedback.title,
      body: parsed.data.body,
      authorLabel: feedback.user?.displayName ?? "A filazo user",
      recipientPath: "/admin/feedback",
    });
    if (!result.sent) query.set("commentEmailSkipped", "1");
  } catch (error) {
    query.set("commentEmailFailed", "1");
    console.error("Failed to send feedback comment email.", {
      feedbackId: feedback.id,
      userId,
      error,
    });
  }

  revalidatePath("/feedback");
  revalidatePath("/admin/feedback");
  redirect(`/feedback?${query.toString()}`);
}

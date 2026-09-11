"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createJournalEntryForUser,
  updateJournalEntryForUser,
} from "@/lib/journal";
import { journalUploadPayloadSchema } from "@/lib/journal-media";
import { createTranslator } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";

const pageSchema = z.object({
  userGameEntryId: z.string().trim().min(1),
  journalEntryId: z.string().trim().min(1).optional(),
  title: z.string().trim().max(160),
  body: z.string().trim().max(4000),
  occurredAt: z.iso.datetime({ offset: true }).optional(),
});

function parseUpload(value: FormDataEntryValue | null) {
  return typeof value === "string" && value
    ? journalUploadPayloadSchema.parse(JSON.parse(value))
    : null;
}

// Return validation errors to the mounted form so text and attachments survive a retry.
export async function saveJournalPageAction(formData: FormData) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) return { error: t("profileAction.needJournalLogin") };

  const parsed = pageSchema.safeParse({
    userGameEntryId: formData.get("userGameEntryId"),
    journalEntryId: formData.get("journalEntryId") || undefined,
    title: formData.get("title") || "",
    body: formData.get("body") || "",
    occurredAt: formData.get("occurredAt") || undefined,
  });
  if (!parsed.success) return { error: t("profileAction.journalSaveFailed") };

  let slug: string | null = null;
  try {
    const data = parsed.data;
    if (data.journalEntryId) {
      slug = await updateJournalEntryForUser({
        userId,
        userGameEntryId: data.userGameEntryId,
        journalEntryId: data.journalEntryId,
        title: data.title || null,
        body: data.body || null,
        occurredAt: data.occurredAt ? new Date(data.occurredAt) : null,
      });
    } else {
      const imageUpload = parseUpload(formData.get("imageUpload"));
      const audioUpload = parseUpload(formData.get("audioUpload"));
      if (!data.title && !data.body && !imageUpload && !audioUpload) {
        return { error: t("profileAction.journalEmptyPage") };
      }
      await createJournalEntryForUser({
        userId,
        userGameEntryId: data.userGameEntryId,
        title: data.title || null,
        body: data.body || null,
        occurredAt: data.occurredAt ? new Date(data.occurredAt) : null,
        targetLanguage: locale === "pt-BR" ? "Portuguese (Brazil)" : "English",
        imageUpload,
        audioUpload,
      });
    }
  } catch {
    return { error: t("profileAction.journalSaveFailed") };
  }

  revalidatePath("/profile");
  if (slug) revalidatePath(`/games/${slug}`);
  return { success: true };
}

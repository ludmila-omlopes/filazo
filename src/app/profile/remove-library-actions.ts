"use server";

import { revalidatePath } from "next/cache";
import { getSessionUserId } from "@/lib/session";
import { removeLibraryEntry } from "@/lib/remove-library-entry";
import { recomputeRuleInsightsForUser } from "@/lib/assistant/insight-maintenance";

export async function removeLibraryEntryAction(_previous: { result: string }, formData: FormData) {
  const userId = await getSessionUserId();
  const entryId = formData.get("entryId");
  if (!userId || typeof entryId !== "string" || !entryId.trim() || formData.get("confirmed") !== "yes") {
    return { result: "error" };
  }
  try {
    if (!await removeLibraryEntry(userId, entryId)) return { result: "error" };
  } catch {
    return { result: "error" };
  }
  await recomputeRuleInsightsForUser(userId).catch(() => undefined);
  revalidatePath("/profile");
  revalidatePath("/tonight");
  revalidatePath("/games/[slug]", "page");
  revalidatePath("/");
  return { result: "removed" };
}

"use server";

import { UserGameStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSessionUserId } from "@/lib/session";
import { setLibraryEntryStatus } from "@/lib/library-entry";
import { recomputeRuleInsightsForUser } from "@/lib/assistant/insight-maintenance";

export async function saveCatalogStatusAction(_previous: { result: string }, formData: FormData) {
  const userId = await getSessionUserId();
  const entryId = formData.get("entryId");
  const status = formData.get("status");
  if (!userId || typeof entryId !== "string" || typeof status !== "string" ||
      !Object.values(UserGameStatus).includes(status as UserGameStatus)) return { result: "error" };
  try {
    if (!await setLibraryEntryStatus(userId, entryId, status as UserGameStatus)) return { result: "error" };
  } catch {
    return { result: "error" };
  }
  // Derived recommendations must not turn a successful save into a false error.
  await recomputeRuleInsightsForUser(userId).catch(() => undefined);
  revalidatePath("/profile");
  revalidatePath("/tonight");
  revalidatePath("/games/[slug]", "page");
  revalidatePath("/");
  return { result: "saved" };
}

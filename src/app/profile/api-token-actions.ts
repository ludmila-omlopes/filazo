"use server";

import { revalidatePath } from "next/cache";
import { ABUSE_LIMITS } from "@/lib/abuse-policy";
import { checkActionAbuse } from "@/lib/abuse-request";
import { normalizeApiTokenName } from "@/lib/api-token-policy";
import { createApiToken, revokeApiToken } from "@/lib/api-tokens";
import { getSessionUserId } from "@/lib/session";

export type CreateApiTokenState = {
  result: "" | "created" | "invalid" | "limit" | "rateLimited" | "error";
  token?: string;
};

export async function createApiTokenAction(
  _previous: CreateApiTokenState,
  formData: FormData,
): Promise<CreateApiTokenState> {
  const userId = await getSessionUserId();
  if (!userId) return { result: "error" };
  const name = normalizeApiTokenName(formData.get("name"));
  if (!name) return { result: "invalid" };
  if (await checkActionAbuse([ABUSE_LIMITS.apiTokenCreate], userId)) {
    return { result: "rateLimited" };
  }

  const created = await createApiToken(userId, name);
  if (created.result !== "created") return { result: created.result };
  revalidatePath("/profile");
  return created;
}

export type RevokeApiTokenState = { result: "" | "error" };

export async function revokeApiTokenAction(
  _previous: RevokeApiTokenState,
  formData: FormData,
): Promise<RevokeApiTokenState> {
  const userId = await getSessionUserId();
  const tokenId = formData.get("tokenId");
  if (!userId || typeof tokenId !== "string" || !tokenId) return { result: "error" };
  try {
    if (!await revokeApiToken(userId, tokenId)) return { result: "error" };
  } catch {
    return { result: "error" };
  }
  revalidatePath("/profile");
  return { result: "" };
}

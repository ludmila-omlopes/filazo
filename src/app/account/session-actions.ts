"use server";

import { redirect } from "next/navigation";
import { clearUserSession, getSessionUserId, revokeAllUserSessions } from "@/lib/session";

/** Ends every session of the signed-in user, including stolen or forgotten ones. */
export async function signOutEverywhereAction() {
  const userId = await getSessionUserId();
  if (userId) await revokeAllUserSessions(userId);
  await clearUserSession();
  redirect("/");
}

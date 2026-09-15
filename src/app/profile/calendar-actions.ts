"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUserId } from "@/lib/session";
import { requirePlatformAccess } from "@/lib/beta-access";
import { refreshCalendar } from "@/lib/calendar";
import { parseCalendarDate } from "@/lib/calendar-policy";
import { saveCalendarMinutes, saveCalendarStart, setCalendarRelease } from "@/lib/calendar-writes";

async function authenticatedUser() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  await requirePlatformAccess(userId);
  return userId;
}

function finish(status: string): never {
  revalidatePath("/profile");
  redirect(`/profile?tab=calendar&calendarStatus=${status}`);
}

export async function refreshCalendarAction() {
  const userId = await authenticatedUser();
  let status = "failed";
  try { status = (await refreshCalendar(userId, "manual")).refreshed ? "refreshed" : "limited"; }
  catch { /* Transaction rollback keeps the daily allowance available. */ }
  finish(status);
}

export async function saveCalendarStartAction(data: FormData) {
  const userId = await authenticatedUser();
  const id = z.string().cuid().safeParse(data.get("entryId"));
  const date = parseCalendarDate(data.get("start"));
  if (!id.success || !date) finish("invalid");
  let ok = false;
  try { ok = await saveCalendarStart(userId, id.data, date); } catch { /* Show a safe error. */ }
  finish(ok ? "saved" : "invalid");
}

export async function saveCalendarMinutesAction(data: FormData) {
  const userId = await authenticatedUser();
  const parsed = z.object({ entryId: z.string().cuid(), minutes: z.coerce.number().int().min(0).max(960) }).safeParse({ entryId: data.get("entryId"), minutes: data.get("minutes") });
  if (!parsed.success) finish("invalid");
  let ok = false;
  try { ok = await saveCalendarMinutes(userId, parsed.data.entryId, parsed.data.minutes); } catch { /* Show a safe error. */ }
  finish(ok ? "saved" : "invalid");
}

export async function setCalendarReleaseAction(data: FormData) {
  const userId = await authenticatedUser();
  const id = z.string().cuid().safeParse(data.get("releaseId"));
  if (!id.success) finish("invalid");
  let ok = false;
  try { ok = await setCalendarRelease(userId, id.data, data.get("operation") === "add"); } catch { /* Show a safe error. */ }
  finish(ok ? "saved" : "invalid");
}

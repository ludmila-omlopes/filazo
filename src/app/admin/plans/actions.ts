"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUserWithBeta, isAdminEmail } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const planChangeSchema = z.object({
  userId: z.string().trim().min(1).max(128),
  plan: z.enum(["FREE", "PRO"]),
  previousPlan: z.enum(["FREE", "PRO"]),
});

export async function updateAccountPlanAction(formData: FormData) {
  const admin = await getSessionUserWithBeta(await getSessionUserId());
  if (!admin || !isAdminEmail(admin.email)) redirect("/beta");

  const parsed = planChangeSchema.safeParse({
    userId: formData.get("userId"),
    plan: formData.get("plan"),
    previousPlan: formData.get("previousPlan"),
  });
  if (!parsed.success) redirect("/admin/plans?status=invalid");

  const search = String(formData.get("q") ?? "").trim().slice(0, 100);
  const params = new URLSearchParams({ q: search });
  const { userId, plan, previousPlan } = parsed.data;
  let changed = false;
  try {
    const result = await prisma.user.updateMany({
      where: { id: userId, plan: previousPlan },
      data: { plan },
    });
    changed = result.count === 1;
  } catch {
    params.set("status", "failed");
    redirect(`/admin/plans?${params}`);
  }

  revalidatePath("/admin/plans");
  revalidatePath("/profile");
  params.set("status", changed ? "saved" : "conflict");
  redirect(`/admin/plans?${params}`);
}

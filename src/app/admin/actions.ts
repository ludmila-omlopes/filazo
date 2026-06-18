"use server";

import { BetaTesterStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  getSessionUserWithBeta,
  isAdminEmail,
  oneYearFromNow,
} from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";
import { getRequestTranslator } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";

const reviewSchema = z.object({
  applicationId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  justification: z.string().trim().min(3).max(500),
});

async function requireAdmin() {
  const user = await getSessionUserWithBeta(await getSessionUserId());
  if (!user || !isAdminEmail(user.email)) {
    redirect("/beta");
  }

  return user;
}

export async function reviewBetaApplicationAction(formData: FormData) {
  const { t } = await getRequestTranslator();
  const admin = await requireAdmin();
  const parsed = reviewSchema.safeParse({
    applicationId: formData.get("applicationId"),
    decision: formData.get("decision"),
    justification: formData.get("justification"),
  });

  if (!parsed.success) {
    redirect(
      `/admin?error=${encodeURIComponent(
        t("admin.error.justificationRequired"),
      )}`,
    );
  }

  await prisma.betaTesterApplication.update({
    where: { id: parsed.data.applicationId },
    data: {
      status:
        parsed.data.decision === "approve"
          ? BetaTesterStatus.APPROVED
          : BetaTesterStatus.REJECTED,
      justification: parsed.data.justification,
      reviewedById: admin.id,
      reviewedAt: new Date(),
      accessExpiresAt:
        parsed.data.decision === "approve" ? oneYearFromNow() : null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/beta");
  redirect("/admin?reviewed=1");
}

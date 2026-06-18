"use server";

import { BetaTesterStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { toPlatformJson } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";
import { getRequestTranslator } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";

const betaApplicationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  platforms: z.array(z.string().trim().min(1).max(40)).min(1),
  retroGames: z.string().trim().max(500).optional(),
});

function redirectWithBetaError(message: string): never {
  redirect(`/beta?error=${encodeURIComponent(message)}`);
}

export async function submitBetaApplicationAction(formData: FormData) {
  const { t } = await getRequestTranslator();
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/beta");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { betaApplication: true },
  });
  if (!user?.betaApplication) {
    redirect("/profile");
  }

  const parsed = betaApplicationSchema.safeParse({
    name: formData.get("name"),
    platforms: formData.getAll("platform"),
    retroGames: formData.get("retroGames"),
  });

  if (!parsed.success) {
    redirectWithBetaError(t("beta.error.invalidApplication"));
  }

  await prisma.betaTesterApplication.upsert({
    where: { userId },
    update: {
      name: parsed.data.name,
      platforms: toPlatformJson(parsed.data.platforms),
      retroGames: parsed.data.retroGames || null,
      status: BetaTesterStatus.PENDING,
      justification: null,
      reviewedAt: null,
      reviewedById: null,
      accessExpiresAt: null,
    },
    create: {
      userId,
      name: parsed.data.name,
      platforms: toPlatformJson(parsed.data.platforms),
      retroGames: parsed.data.retroGames || null,
      status: BetaTesterStatus.PENDING,
    },
  });

  revalidatePath("/beta");
  revalidatePath("/admin");
  redirect("/beta?sent=1");
}

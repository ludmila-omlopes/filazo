"use server";

import { UserGameStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setFilazoTheme } from "@/app/theme-actions";
import { createTranslator } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { getSessionUserId } from "@/lib/session";

export async function dimTheLightsAction() {
  await setFilazoTheme("night");
  revalidatePath("/tonight");
}

export async function chooseTonightGameAction(formData: FormData) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/profile");
  }

  const entryId = formData.get("entryId");
  if (typeof entryId !== "string" || !entryId) {
    redirect(
      `/tonight?message=${encodeURIComponent(t("tonight.action.pickAnother"))}`,
    );
  }

  const entry = await prisma.userGameEntry.findUnique({
    where: { id: entryId },
    include: { game: true },
  });

  if (!entry || entry.userId !== userId) {
    redirect("/tonight");
  }

  try {
    await prisma.userGameEntry.update({
      where: { id: entry.id },
      data: {
        status: UserGameStatus.PLAYING,
        activeBacklog: true,
        updatedAt: new Date(),
      },
    });
  } catch {
    redirect(
      `/tonight?message=${encodeURIComponent(
        t("tonight.action.alreadyCloseBy"),
      )}`,
    );
  }

  revalidatePath("/tonight");
  revalidatePath("/profile");
  revalidatePath(`/games/${entry.game.slug}`);
  redirect(
    `/tonight?message=${encodeURIComponent(
      t("tonight.action.markedPlaying", { name: entry.game.name }),
    )}`,
  );
}

import { Prisma, type PrismaClient } from "@prisma/client";

/** A provider's review ID is global; a conflict must not move a private row. */
export async function saveImportedReview(db: PrismaClient, input: {
  userId: string;
  userGameEntryId: string;
  gameId: string;
  provider: "STEAM";
  externalReviewId: string;
  data: Pick<Prisma.UserGameReviewUncheckedCreateInput,
    "body" | "language" | "recommended" | "reviewedAt" | "sourceUrl" |
    "updatedOnProviderAt" | "rawData"
  >;
}) {
  const { userId, userGameEntryId, gameId, provider, externalReviewId, data } = input;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const entry = await tx.userGameEntry.findFirst({
          where: { id: userGameEntryId, userId, gameId }, select: { id: true },
        });
        if (!entry) return false;
        const existing = await tx.userGameReview.findUnique({
          where: { provider_externalReviewId: { provider, externalReviewId } },
          select: { id: true, userId: true },
        });
        if (existing && existing.userId !== userId) return false;
        if (existing) {
          await tx.userGameReview.update({
            where: { id: existing.id, userId },
            data: { ...data, userGameEntryId, gameId },
          });
        } else {
          await tx.userGameReview.create({
            data: { ...data, userId, userGameEntryId, gameId, provider, externalReviewId },
          });
        }
        return true;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" && attempt < 2) continue;
      throw error;
    }
  }
  return false;
}

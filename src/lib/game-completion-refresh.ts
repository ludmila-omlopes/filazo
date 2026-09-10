import { GameCompletionModelSource, type Prisma } from "@prisma/client";
import { inferGameCompletionModel } from "./game-completion-model.ts";

// Use the caller's client so catalog transactions keep their atomicity.
export async function refreshGameCompletionModel(
  prisma: Prisma.TransactionClient,
  gameId: string,
) {
  const { providerLinks, ...game } = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: { providerLinks: { select: { storyAchievementId: true } } },
  });
  if (game.completionModelSource === GameCompletionModelSource.MANUAL) {
    return game;
  }

  const completion = inferGameCompletionModel({ ...game, providerLinks });
  return prisma.game.update({
    where: { id: gameId },
    data: {
      completionModel: completion.model,
      completionModelSource:
        completion.model === "UNKNOWN" ? null : GameCompletionModelSource.RULES,
      completionModelConfidence: completion.confidence,
      completionModelCheckedAt: new Date(),
    },
  });
}

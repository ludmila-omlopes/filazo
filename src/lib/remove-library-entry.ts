import { prisma } from "@/lib/prisma";
import { lockLibraryGame } from "@/lib/library-entry";
import { removeUploadedFile } from "@/lib/journal";

export async function removeLibraryEntry(userId: string, entryId: string) {
  const removed = await prisma.$transaction(async (tx) => {
    // Share the user lock with library imports, status updates and queue changes.
    await lockLibraryGame(tx, userId, "remove-entry");
    const entry = await tx.userGameEntry.findFirst({
      where: { id: entryId, userId },
      select: {
        journalEntries: {
          where: { userId },
          select: { media: { select: { storageKey: true, storageProvider: true } } },
        },
      },
    });
    if (!entry) return null;

    // Keep ownership in the write. Other platforms and the canonical Game stay intact.
    // Reviews, diary pages and calendar records for this copy cascade in the database.
    const result = await tx.userGameEntry.deleteMany({ where: { id: entryId, userId } });
    return result.count === 1 ? entry : null;
  });
  if (!removed) return false;

  // Remove uploaded media only after commit; storage failures must not report a failed deletion.
  await Promise.allSettled(removed.journalEntries.flatMap((entry) =>
    entry.media.map((media) => removeUploadedFile(media)),
  ));
  return true;
}

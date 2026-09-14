import { Prisma, type PrismaClient, type ExternalProvider } from "@prisma/client";
import { getUserProfileSyncData } from "./user-profile-sync.ts";

type AccountData = Pick<Prisma.ExternalAccountUncheckedCreateInput,
  "username" | "displayName" | "avatarUrl" | "profileUrl" | "metadata" |
  "nextSyncAt" | "lastSyncErrorCode" | "syncFailureCount"
>;

export class AccountOwnershipConflict extends Error {
  constructor() {
    super("This platform account is already connected to another user.");
    this.name = "AccountOwnershipConflict";
  }
}

/** Connecting a provider can refresh credentials, but never transfer ownership. */
export async function linkExternalAccountForUser(db: PrismaClient, input: {
  userId: string;
  provider: ExternalProvider;
  providerAccountId: string;
  profile: { displayName?: string | null; avatarUrl?: string | null };
  data: AccountData;
}) {
  const { userId, provider, providerAccountId, profile, data } = input;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const existing = await tx.externalAccount.findUnique({
          where: { provider_providerAccountId: { provider, providerAccountId } },
          select: { id: true, userId: true },
        });
        if (existing && existing.userId !== userId) throw new AccountOwnershipConflict();
        const user = await tx.user.findUnique({
          where: { id: userId }, select: { displayName: true, avatarUrl: true },
        });
        if (!user) throw new Error("Sign in before connecting a platform.");

        const account = existing
          ? await tx.externalAccount.update({
              where: { id: existing.id, userId }, data,
            })
          : await tx.externalAccount.create({
              data: { ...data, userId, provider, providerAccountId },
            });
        await tx.user.update({
          where: { id: userId }, data: getUserProfileSyncData(user, profile),
        });
        return account;
      });
    } catch (error) {
      // A simultaneous first connection may have won the unique key. Recheck
      // its owner in a new transaction; PostgreSQL aborts the failed one.
      if (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("Could not connect this platform account.");
}

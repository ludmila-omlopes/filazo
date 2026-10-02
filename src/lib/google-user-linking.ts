import type { PrismaClient } from "@prisma/client";

export class GoogleIdentityConflict extends Error {
  constructor() { super("Google identity requires authenticated account linking."); }
}

/** Both legacy subject columns represent the same validated Google identity. */
export async function resolveGoogleIdentity(db: PrismaClient, profile: {
  subject: string; email: string; name: string | null; picture: string | null;
}, { youtube = false, allowCreate = true, registrationClosedMessage = "Registration closed." } = {}) {
  const email = profile.email.trim().toLowerCase();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const matches = await tx.user.findMany({ where: { OR: [
          { googleSubject: profile.subject }, { youtubeSubject: profile.subject },
        ] }, take: 2 });
        if (matches.length > 1) throw new GoogleIdentityConflict();
        const bySubject = matches[0];
        const existing = bySubject ?? await tx.user.findUnique({ where: { email } });
        if (existing) {
          if ((existing.googleSubject && existing.googleSubject !== profile.subject) ||
              (existing.youtubeSubject && existing.youtubeSubject !== profile.subject) ||
              (!bySubject && (!existing.passwordHash || !existing.passwordVerifiedAt))) {
            throw new GoogleIdentityConflict();
          }
          const updated = await tx.user.updateMany({ where: {
            id: existing.id, email: existing.email,
            googleSubject: existing.googleSubject, youtubeSubject: existing.youtubeSubject,
            ...(!bySubject ? { passwordHash: existing.passwordHash, passwordVerifiedAt: existing.passwordVerifiedAt } : {}),
          }, data: {
            googleSubject: profile.subject,
            ...(youtube ? { youtubeSubject: profile.subject } : {}),
            displayName: existing.displayName ?? profile.name,
            avatarUrl: existing.avatarUrl ?? profile.picture,
          } });
          if (updated.count !== 1) throw new GoogleIdentityConflict();
          return tx.user.findUniqueOrThrow({ where: { id: existing.id } });
        }
        if (!allowCreate) throw new Error(registrationClosedMessage);
        return tx.user.create({ data: {
          email, googleSubject: profile.subject,
          ...(youtube ? { youtubeSubject: profile.subject } : {}),
          displayName: profile.name ?? email.split("@")[0], avatarUrl: profile.picture,
        } });
      });
    } catch (error) {
      // Retry unique races in a fresh transaction so the winner's identity is rechecked.
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        if (attempt < 2) continue;
        throw new GoogleIdentityConflict();
      }
      throw error;
    }
  }
  throw new GoogleIdentityConflict();
}

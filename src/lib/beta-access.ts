import { BetaTesterStatus, type Prisma, type User } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const ADMIN_EMAIL = "ludmila.omlopes@gmail.com";

export function isAdminEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
}

type AccessUser = Pick<User, "email" | "createdAt"> & {
  betaApplication?: {
    status: BetaTesterStatus;
    accessExpiresAt: Date | null;
  } | null;
};

export function canAccessPlatform(user: AccessUser | null) {
  return Boolean(user);
}

export async function getSessionUserWithBeta(userId: string | null) {
  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
    include: { betaApplication: true, billingSubscriptions: true },
  });
}

export function getBetaAccessRedirect(user: AccessUser | null) {
  if (!user) {
    return "/login";
  }

  return null;
}

export async function requirePlatformAccess(userId: string | null) {
  const user = await getSessionUserWithBeta(userId);
  const accessRedirect = getBetaAccessRedirect(user);

  if (accessRedirect) {
    redirect(accessRedirect);
  }

  return user;
}

export async function createOrUpdateYoutubeBetaUser(profile: {
  subject: string;
  email: string;
  name: string | null;
  picture: string | null;
}) {
  const existingByYoutube = await prisma.user.findUnique({
    where: { youtubeSubject: profile.subject },
    include: { betaApplication: true },
  });

  const existingByGoogle = await prisma.user.findUnique({
    where: { googleSubject: profile.subject },
    include: { betaApplication: true },
  });

  const existingByEmail = await prisma.user.findUnique({
    where: { email: profile.email },
    include: { betaApplication: true },
  });

  const existing = existingByYoutube ?? existingByGoogle ?? existingByEmail;
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          email: existing.email ?? profile.email,
          displayName: existing.displayName ?? profile.name ?? undefined,
          avatarUrl: existing.avatarUrl ?? profile.picture ?? undefined,
          googleSubject: existing.googleSubject ?? profile.subject,
          youtubeSubject: existing.youtubeSubject ?? profile.subject,
        },
      })
    : await prisma.user.create({
        data: {
          email: profile.email,
          displayName: profile.name ?? profile.email.split("@")[0],
          avatarUrl: profile.picture,
          googleSubject: profile.subject,
          youtubeSubject: profile.subject,
        },
      });

  if (!isAdminEmail(user.email) && !existing) {
    await prisma.betaTesterApplication.create({
      data: {
        userId: user.id,
        name: profile.name,
        status: BetaTesterStatus.DRAFT,
      },
    });
  }

  return user;
}

export function oneYearFromNow() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date;
}

export function toPlatformJson(platforms: string[]) {
  return platforms as Prisma.InputJsonValue;
}

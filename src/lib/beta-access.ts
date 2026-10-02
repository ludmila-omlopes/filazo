import { type Prisma, type User } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveGoogleIdentity } from "@/lib/google-user-linking";

export const ADMIN_EMAIL = "ludmila.omlopes@gmail.com";

export function isAdminEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
}

type AccessUser = Pick<User, "email" | "createdAt">;

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
  return resolveGoogleIdentity(prisma, profile, { youtube: true });
}

export function oneYearFromNow() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date;
}

export function toPlatformJson(platforms: string[]) {
  return platforms as Prisma.InputJsonValue;
}

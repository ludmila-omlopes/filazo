import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { ExternalProvider } from "@prisma/client";
import { getAuthSecret } from "@/lib/auth-secret";
import { PLATFORM_SYNC_INACTIVE_WEEKLY_AFTER_MS } from "@/lib/platform-sync-policy";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "filazo-session";
const SESSION_DURATION = 60 * 60 * 24 * 30;
const ACTIVITY_TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const PLATFORM_SYNC_PROVIDERS = [
  ExternalProvider.STEAM,
  ExternalProvider.PLAYSTATION,
  ExternalProvider.XBOX,
];

function getSessionSecret() {
  return new TextEncoder().encode(getAuthSecret());
}

async function touchUserActivity(userId: string) {
  try {
    const now = new Date();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastActiveAt: true },
    });
    if (!user || user.lastActiveAt.getTime() > now.getTime() - ACTIVITY_TOUCH_INTERVAL_MS) {
      return;
    }

    const shouldResumeDailySync =
      user.lastActiveAt.getTime() <=
      now.getTime() - PLATFORM_SYNC_INACTIVE_WEEKLY_AFTER_MS;

    await prisma.$transaction(async (transaction) => {
      if (shouldResumeDailySync) {
        await transaction.externalAccount.updateMany({
          where: {
            userId,
            provider: { in: PLATFORM_SYNC_PROVIDERS },
          },
          data: { nextSyncAt: now },
        });
      }
      await transaction.user.update({
        where: { id: userId },
        data: { lastActiveAt: now },
      });
    });
  } catch {
    // A telemetry write must not turn an otherwise valid session into a logout.
  }
}

export async function setUserSession(userId: string) {
  await touchUserActivity(userId);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSessionSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION,
  });
}

export async function clearUserSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUserId() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, getSessionSecret());
    const userId = typeof verified.payload.sub === "string" ? verified.payload.sub : null;
    if (userId) await touchUserActivity(userId);
    return userId;
  } catch {
    return null;
  }
}

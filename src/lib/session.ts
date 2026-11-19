import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { ExternalProvider } from "@prisma/client";
import { getAuthSecret } from "@/lib/auth-secret";
import { PLATFORM_SYNC_INACTIVE_WEEKLY_AFTER_MS } from "@/lib/platform-sync-policy";
import { prisma } from "@/lib/prisma";
import { recordDailyActivity } from "@/lib/platform-telemetry";

const AUTH_POLICY = "email-proof-v1";
const SESSION_COOKIE = "filazo-session";
const SESSION_DURATION = 60 * 60 * 24 * 30;
const ACTIVITY_TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const PLATFORM_SYNC_PROVIDERS = [
  ExternalProvider.STEAM,
  ExternalProvider.PLAYSTATION,
  ExternalProvider.XBOX,
  ExternalProvider.GOG,
];

const SESSION_USER_SELECT = { sessionVersion: true, lastActiveAt: true } as const;

function getSessionSecret() {
  return new TextEncoder().encode(getAuthSecret());
}

async function touchUserActivity(userId: string, lastActiveAt: Date) {
  try {
    const now = new Date();
    await recordDailyActivity(userId, now);
    if (lastActiveAt.getTime() > now.getTime() - ACTIVITY_TOUCH_INTERVAL_MS) {
      return;
    }

    const shouldResumeDailySync =
      lastActiveAt.getTime() <=
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
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: SESSION_USER_SELECT,
  });
  await touchUserActivity(userId, user.lastActiveAt);
  const token = await new SignJWT({
    authPolicy: AUTH_POLICY,
    sessionVersion: user.sessionVersion,
  })
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

/** Signs a user out everywhere: every token issued so far stops matching. */
export async function revokeAllUserSessions(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
}

export async function getSessionUserId() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  let userId: string;
  let tokenVersion: unknown;
  try {
    const verified = await jwtVerify(token, getSessionSecret(), { algorithms: ["HS256"] });
    if (verified.payload.authPolicy !== AUTH_POLICY) return null;
    if (typeof verified.payload.sub !== "string") return null;
    userId = verified.payload.sub;
    tokenVersion = verified.payload.sessionVersion;
  } catch {
    return null;
  }

  let user: { sessionVersion: number; lastActiveAt: Date } | null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: SESSION_USER_SELECT,
    });
  } catch {
    // Every protected read and write needs the database too. During an outage,
    // keep the signed session instead of turning a database error into a logout.
    return userId;
  }

  // Deleted accounts and revoked sessions end here. Tokens issued before
  // revocation existed carry no version and match the initial value 0.
  if (!user || user.sessionVersion !== (tokenVersion ?? 0)) return null;
  await touchUserActivity(userId, user.lastActiveAt);
  return userId;
}

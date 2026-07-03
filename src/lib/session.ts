import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { getAuthSecret } from "@/lib/auth-secret";

const SESSION_COOKIE = "filazo-session";
const SESSION_DURATION = 60 * 60 * 24 * 30;

function getSessionSecret() {
  return new TextEncoder().encode(getAuthSecret());
}

export async function setUserSession(userId: string) {
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
    return typeof verified.payload.sub === "string" ? verified.payload.sub : null;
  } catch {
    return null;
  }
}

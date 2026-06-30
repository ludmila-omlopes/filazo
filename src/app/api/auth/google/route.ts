import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createGoogleAuthUrl } from "@/lib/google-auth";
import {
  createBrowserRequiredUrl,
  isGoogleOAuthBlockedUserAgent,
} from "@/lib/oauth-browser";

export const GOOGLE_OAUTH_STATE_COOKIE = "filazo-google-oauth-state";
export const GOOGLE_OAUTH_NONCE_COOKIE = "filazo-google-oauth-nonce";

function setOAuthCookie(name: string, value: string) {
  return {
    name,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  };
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const returnPath = "/login?auth=1";

    if (isGoogleOAuthBlockedUserAgent(request.headers.get("user-agent"))) {
      return NextResponse.redirect(
        createBrowserRequiredUrl(requestUrl, returnPath),
      );
    }

    const origin = process.env.APP_URL || requestUrl.origin;
    const state = crypto.randomBytes(16).toString("hex");
    const nonce = crypto.randomBytes(16).toString("hex");
    const authUrl = createGoogleAuthUrl({ nonce, origin, state });
    const cookieStore = await cookies();

    cookieStore.set(setOAuthCookie(GOOGLE_OAUTH_STATE_COOKIE, state));
    cookieStore.set(setOAuthCookie(GOOGLE_OAUTH_NONCE_COOKIE, nonce));

    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start Google login.";

    return NextResponse.redirect(
      new URL(`/login?auth=1&error=${encodeURIComponent(message)}`, request.url),
    );
  }
}

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createGoogleAuthUrl } from "@/lib/google-auth";
import {
  createBrowserRequiredUrl,
  isGoogleOAuthBlockedUserAgent,
} from "@/lib/oauth-browser";
import { getRequestTranslator } from "@/lib/request-locale";
import { reportAuthFailure } from "@/lib/auth-errors";

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
  const requestId = crypto.randomUUID();
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
    reportAuthFailure(error, {
      provider: "google",
      route: "/api/auth/google",
      stage: "start-auth",
      requestId,
    });
    const { t } = await getRequestTranslator();
    const message = t("auth.error.googleStartFailed", {
      reference: requestId.slice(0, 8),
    });

    return NextResponse.redirect(
      new URL(
        `/login?auth=1&error=${encodeURIComponent(message)}&ref=${encodeURIComponent(requestId)}`,
        request.url,
      ),
    );
  }
}

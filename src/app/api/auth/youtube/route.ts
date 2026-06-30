import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createGoogleAuthUrl, getYoutubeRedirectUri } from "@/lib/google-auth";
import {
  createBrowserRequiredUrl,
  getSafeOAuthReturnPath,
  isGoogleOAuthBlockedUserAgent,
} from "@/lib/oauth-browser";
import { getRequestTranslator } from "@/lib/request-locale";

export const YOUTUBE_OAUTH_STATE_COOKIE = "filazo-youtube-oauth-state";
export const YOUTUBE_OAUTH_NONCE_COOKIE = "filazo-youtube-oauth-nonce";

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
  const requestUrl = new URL(request.url);
  const returnPath = getSafeOAuthReturnPath(
    requestUrl.searchParams.get("next"),
    "/beta",
  );

  try {
    if (isGoogleOAuthBlockedUserAgent(request.headers.get("user-agent"))) {
      return NextResponse.redirect(
        createBrowserRequiredUrl(requestUrl, returnPath),
      );
    }

    const origin = process.env.APP_URL || requestUrl.origin;
    const state = crypto.randomBytes(16).toString("hex");
    const nonce = crypto.randomBytes(16).toString("hex");
    const authUrl = createGoogleAuthUrl({
      nonce,
      origin,
      redirectUri: getYoutubeRedirectUri(origin),
      state,
      scope: "openid email profile",
    });
    const cookieStore = await cookies();

    cookieStore.set(setOAuthCookie(YOUTUBE_OAUTH_STATE_COOKIE, state));
    cookieStore.set(setOAuthCookie(YOUTUBE_OAUTH_NONCE_COOKIE, nonce));

    return NextResponse.redirect(authUrl);
  } catch (error) {
    const { t } = await getRequestTranslator();
    const message =
      error instanceof Error
        ? error.message
        : t("auth.error.youtubeStartFailed");
    const errorUrl = new URL(returnPath, request.url);
    errorUrl.searchParams.set("error", message);

    return NextResponse.redirect(errorUrl);
  }
}

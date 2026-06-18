import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createOrUpdateYoutubeBetaUser, isAdminEmail } from "@/lib/beta-access";
import {
  exchangeGoogleCodeForProfile,
  getYoutubeRedirectUri,
} from "@/lib/google-auth";
import { getRequestTranslator } from "@/lib/request-locale";
import { setUserSession } from "@/lib/session";

const YOUTUBE_OAUTH_STATE_COOKIE = "filazo-youtube-oauth-state";
const YOUTUBE_OAUTH_NONCE_COOKIE = "filazo-youtube-oauth-nonce";

export async function GET(request: Request) {
  try {
    const { t } = await getRequestTranslator();
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(YOUTUBE_OAUTH_STATE_COOKIE)?.value;
    const nonce = cookieStore.get(YOUTUBE_OAUTH_NONCE_COOKIE)?.value;
    cookieStore.delete(YOUTUBE_OAUTH_STATE_COOKIE);
    cookieStore.delete(YOUTUBE_OAUTH_NONCE_COOKIE);

    if (!code) {
      throw new Error(t("auth.error.youtubeMissingCode"));
    }

    if (!state || !expectedState || state !== expectedState || !nonce) {
      throw new Error(t("auth.error.youtubeStateInvalid"));
    }

    const origin = process.env.APP_URL || url.origin;
    const profile = await exchangeGoogleCodeForProfile({
      code,
      nonce,
      origin,
      redirectUri: getYoutubeRedirectUri(origin),
    });
    const user = await createOrUpdateYoutubeBetaUser(profile);

    await setUserSession(user.id);

    return NextResponse.redirect(
      new URL(isAdminEmail(user.email) ? "/admin" : "/beta", request.url),
    );
  } catch (error) {
    const { t } = await getRequestTranslator();
    const message =
      error instanceof Error
        ? error.message
        : t("auth.error.youtubeCallbackFailed");

    return NextResponse.redirect(
      new URL(`/beta?error=${encodeURIComponent(message)}`, request.url),
    );
  }
}

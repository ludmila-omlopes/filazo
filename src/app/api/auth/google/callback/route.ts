import { cookies } from "next/headers";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  exchangeGoogleCodeForProfile,
  upsertGoogleUser,
} from "@/lib/google-auth";
import { setUserSession } from "@/lib/session";
import { getRequestTranslator } from "@/lib/request-locale";
import {
  reportAuthFailure,
  type AuthFailureStage,
} from "@/lib/auth-errors";

const GOOGLE_OAUTH_STATE_COOKIE = "filazo-google-oauth-state";
const GOOGLE_OAUTH_NONCE_COOKIE = "filazo-google-oauth-nonce";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  let stage: AuthFailureStage = "unknown";
  let userMessage: string | null = null;

  try {
    const { t } = await getRequestTranslator();
    const url = new URL(request.url);
    stage = "callback-parameters";
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
    const nonce = cookieStore.get(GOOGLE_OAUTH_NONCE_COOKIE)?.value;
    cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE);
    cookieStore.delete(GOOGLE_OAUTH_NONCE_COOKIE);

    if (!code) {
      userMessage = t("auth.error.googleMissingCode");
      throw new Error("Missing Google authorization code.");
    }

    if (!state || !expectedState || state !== expectedState || !nonce) {
      stage = "verify-state";
      userMessage = t("auth.error.googleStateInvalid");
      throw new Error("Google login state could not be verified.");
    }

    const origin = process.env.APP_URL || url.origin;
    stage = "exchange-code";
    const profile = await exchangeGoogleCodeForProfile({ code, nonce, origin });
    stage = "load-user";
    const user = await upsertGoogleUser(profile, {
      registrationClosedMessage: t("auth.error.googleRegistrationClosed"),
    });

    stage = "create-session";
    await setUserSession(user.id);

    return NextResponse.redirect(new URL("/profile?login=google", request.url));
  } catch (error) {
    reportAuthFailure(error, {
      provider: "google",
      route: "/api/auth/google/callback",
      stage,
      requestId,
    });

    const { t } = await getRequestTranslator();
    const message =
      userMessage ??
      (error instanceof Error &&
      error.message === t("auth.error.googleRegistrationClosed")
        ? error.message
        : t("auth.error.googleCallbackFailed", {
            reference: requestId.slice(0, 8),
          }));

    return NextResponse.redirect(
      new URL(
        `/login?auth=1&error=${encodeURIComponent(message)}&ref=${encodeURIComponent(requestId)}`,
        request.url,
      ),
    );
  }
}

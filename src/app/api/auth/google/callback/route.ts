import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeGoogleCodeForProfile,
  upsertGoogleUser,
} from "@/lib/google-auth";
import { setUserSession } from "@/lib/session";

const GOOGLE_OAUTH_STATE_COOKIE = "filazo-google-oauth-state";
const GOOGLE_OAUTH_NONCE_COOKIE = "filazo-google-oauth-nonce";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
    const nonce = cookieStore.get(GOOGLE_OAUTH_NONCE_COOKIE)?.value;
    cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE);
    cookieStore.delete(GOOGLE_OAUTH_NONCE_COOKIE);

    if (!code) {
      throw new Error("Google did not return an authorization code.");
    }

    if (!state || !expectedState || state !== expectedState || !nonce) {
      throw new Error("Google login state could not be verified.");
    }

    const origin = process.env.APP_URL || url.origin;
    const profile = await exchangeGoogleCodeForProfile({ code, nonce, origin });
    const user = await upsertGoogleUser(profile);

    await setUserSession(user.id);

    return NextResponse.redirect(new URL("/profile?login=google", request.url));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not finish Google login.";

    return NextResponse.redirect(
      new URL(`/login?auth=1&error=${encodeURIComponent(message)}`, request.url),
    );
  }
}

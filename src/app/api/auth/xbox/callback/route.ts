import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestTranslator } from "@/lib/request-locale";
import { getSessionUserId, setUserSession } from "@/lib/session";
import { connectXboxAccountForUser } from "@/lib/xbox";

const XBOX_OAUTH_STATE_COOKIE = "filazo-xbox-oauth-state";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { t } = await getRequestTranslator();
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(XBOX_OAUTH_STATE_COOKIE)?.value;
    cookieStore.delete(XBOX_OAUTH_STATE_COOKIE);

    if (!code) {
      throw new Error("Xbox did not return an authorization code.");
    }

    if (!state || !expectedState || state !== expectedState) {
      throw new Error("Xbox sign-in state could not be verified.");
    }

    const origin = process.env.APP_URL || url.origin;
    const existingSessionUserId = await getSessionUserId();
    const user = existingSessionUserId
      ? await prisma.user.findUnique({ where: { id: existingSessionUserId } })
      : null;

    if (!user) {
      throw new Error(t("auth.error.xboxRegistrationClosed"));
    }

    await connectXboxAccountForUser({
      userId: user.id,
      code,
      origin,
    });

    await setUserSession(user.id);

    return NextResponse.redirect(
      new URL("/profile?tab=integrations&xbox=connected", request.url),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not connect Xbox.";
    return NextResponse.redirect(
      new URL(`/profile?error=${encodeURIComponent(message)}`, request.url),
    );
  }
}

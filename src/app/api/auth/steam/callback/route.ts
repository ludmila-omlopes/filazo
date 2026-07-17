import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestTranslator } from "@/lib/request-locale";
import { getSessionUserId, setUserSession } from "@/lib/session";
import { upsertSteamAccountForUser, verifySteamOpenIdCallback } from "@/lib/steam";

import { cookies } from "next/headers";

const STEAM_OPENID_STATE_COOKIE = "filazo-steam-oauth-state";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { t } = await getRequestTranslator();
    const state = url.searchParams.get("state");
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(STEAM_OPENID_STATE_COOKIE)?.value;
    cookieStore.delete(STEAM_OPENID_STATE_COOKIE);

    if (!state || !expectedState || state !== expectedState) {
      throw new Error("Steam sign-in state could not be verified.");
    }

    const steamId = await verifySteamOpenIdCallback(url.searchParams);
    const existingSessionUserId = await getSessionUserId();

    const existingSteamAccount = await prisma.externalAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "STEAM",
          providerAccountId: steamId,
        },
      },
      include: {
        user: true,
      },
    });

    const user = existingSessionUserId
      ? await prisma.user.findUnique({ where: { id: existingSessionUserId } })
      : existingSteamAccount?.user ?? null;

    if (!user) {
      throw new Error(t("auth.error.steamRegistrationClosed"));
    }

    await upsertSteamAccountForUser({
      userId: user.id,
      steamId,
    });

    await setUserSession(user.id);

    return NextResponse.redirect(
      new URL("/profile?tab=integrations&connected=steam", request.url),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not connect Steam.";
    return NextResponse.redirect(
      new URL(`/profile?error=${encodeURIComponent(message)}`, request.url),
    );
  }
}

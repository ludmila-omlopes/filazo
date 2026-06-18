import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestTranslator } from "@/lib/request-locale";
import { getSessionUserId, setUserSession } from "@/lib/session";
import { upsertSteamAccountForUser, verifySteamOpenIdCallback } from "@/lib/steam";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { t } = await getRequestTranslator();
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

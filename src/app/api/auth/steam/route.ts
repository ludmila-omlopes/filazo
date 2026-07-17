import { NextResponse } from "next/server";
import { createSteamAuthUrl } from "@/lib/steam";

import crypto from "node:crypto";
import { cookies } from "next/headers";

const STEAM_OPENID_STATE_COOKIE = "filazo-steam-oauth-state";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const origin = process.env.APP_URL || requestUrl.origin;
    const state = crypto.randomBytes(16).toString("hex");
    const cookieStore = await cookies();

    cookieStore.set(STEAM_OPENID_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    return NextResponse.redirect(createSteamAuthUrl(origin, state));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start Steam sign-in.";

    return NextResponse.redirect(
      new URL(`/profile?error=${encodeURIComponent(message)}`, request.url),
    );
  }
}

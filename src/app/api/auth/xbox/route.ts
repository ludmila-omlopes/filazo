import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createXboxAuthUrl } from "@/lib/xbox";

const XBOX_OAUTH_STATE_COOKIE = "filazo-xbox-oauth-state";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const origin = process.env.APP_URL || requestUrl.origin;
    const state = crypto.randomBytes(16).toString("hex");
    const cookieStore = await cookies();

    cookieStore.set(XBOX_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    return NextResponse.redirect(createXboxAuthUrl(origin, state));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start Xbox sign-in.";

    return NextResponse.redirect(
      new URL(`/profile?error=${encodeURIComponent(message)}`, request.url),
    );
  }
}

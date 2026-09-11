import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createGogAuthUrl,
  GOG_OAUTH_STATE_COOKIE,
} from "@/lib/gog";
import { getSessionUserId } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.redirect(
        new URL("/login?next=/profile?tab=integrations", request.url),
      );
    }

    const state = crypto.randomBytes(32).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set(GOG_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    return NextResponse.redirect(createGogAuthUrl(state));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start GOG sign-in.";
    return NextResponse.redirect(
      new URL(
        `/profile?tab=integrations&error=${encodeURIComponent(message)}`,
        request.url,
      ),
    );
  }
}

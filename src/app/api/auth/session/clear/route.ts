import { NextResponse } from "next/server";
import { getSessionClearRedirectPath } from "@/lib/oauth-browser";
import { clearUserSession } from "@/lib/session";

export async function GET(request: Request) {
  await clearUserSession();
  const url = new URL(request.url);
  const path = getSessionClearRedirectPath(
    url.searchParams.get("next"),
    url.searchParams.get("reason"),
  );
  return NextResponse.redirect(new URL(path, request.url));
}

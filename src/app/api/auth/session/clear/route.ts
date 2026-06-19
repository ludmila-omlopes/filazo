import { NextResponse } from "next/server";
import { clearUserSession } from "@/lib/session";

function getRedirectPath(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  const reason = url.searchParams.get("reason");
  const fallback =
    reason === "expired"
      ? "/login?auth=1&expired=1"
      : "/login";

  if (!next?.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  if (reason !== "expired") {
    return next;
  }

  const redirectUrl = new URL(next, url.origin);
  redirectUrl.searchParams.set("auth", "1");
  redirectUrl.searchParams.set("expired", "1");
  return `${redirectUrl.pathname}${redirectUrl.search}`;
}

export async function GET(request: Request) {
  await clearUserSession();
  return NextResponse.redirect(new URL(getRedirectPath(request), request.url));
}

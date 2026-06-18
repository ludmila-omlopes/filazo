"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocale } from "@/lib/i18n";

export async function setFilazoLocale(nextLocale: string) {
  const locale = parseLocale(nextLocale);
  const cookieStore = await cookies();

  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}

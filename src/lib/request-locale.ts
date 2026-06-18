import "server-only";

import { cookies, headers } from "next/headers";
import {
  LOCALE_COOKIE,
  createTranslator,
  getPreferredLocale,
  parseLocale,
} from "./i18n";

export async function getRequestLocale() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;

  if (cookieLocale) {
    return parseLocale(cookieLocale);
  }

  const headerStore = await headers();
  return getPreferredLocale(headerStore.get("accept-language"));
}

export async function getRequestTranslator() {
  const locale = await getRequestLocale();
  return {
    locale,
    t: createTranslator(locale),
  };
}

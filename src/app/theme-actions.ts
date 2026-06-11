"use server";

import { cookies } from "next/headers";
import {
  FILAZO_THEME_COOKIE,
  parseFilazoTheme,
  type FilazoTheme,
} from "@/lib/theme";

export async function setFilazoTheme(theme: FilazoTheme) {
  const nextTheme = parseFilazoTheme(theme);
  const cookieStore = await cookies();

  cookieStore.set(FILAZO_THEME_COOKIE, nextTheme, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

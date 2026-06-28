"use server";

import { cookies } from "next/headers";
import {
  FILAZO_THEME_COOKIE,
  parseFilazoThemeMode,
  type FilazoThemeMode,
} from "@/lib/theme";

export async function setFilazoThemeMode(mode: FilazoThemeMode) {
  const next = parseFilazoThemeMode(mode);
  const cookieStore = await cookies();

  cookieStore.set(FILAZO_THEME_COOKIE, next, {
    // Readable by the pre-paint inline script so "auto" can resolve the
    // visitor's local time before first paint (no flash of the wrong theme).
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

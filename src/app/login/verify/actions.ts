"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ABUSE_LIMITS } from "@/lib/abuse-policy";
import { checkActionAbuse } from "@/lib/abuse-request";
import { confirmEmailRegistration, EMAIL_REGISTRATION_COOKIE, EmailRegistrationError } from "@/lib/email-registration";
import { prisma } from "@/lib/prisma";
import { getRequestTranslator } from "@/lib/request-locale";
import { getSessionUserId, setUserSession } from "@/lib/session";

export async function confirmEmailRegistrationAction(form: FormData) {
  const { t } = await getRequestTranslator();
  if (await getSessionUserId()) redirect("/profile");
  const limitError = await checkActionAbuse([ABUSE_LIMITS.loginIp]);
  if (limitError) redirect(`/login?auth=1&error=${encodeURIComponent(limitError)}`);
  const cookieStore = await cookies();
  let user;
  try {
    user = await confirmEmailRegistration(prisma, String(form.get("token") ?? ""),
      cookieStore.get(EMAIL_REGISTRATION_COOKIE)?.value);
  } catch (error) {
    const message = t(error instanceof EmailRegistrationError && error.reason === "exists"
      ? "auth.error.accountExists" : "auth.error.verificationInvalid");
    redirect(`/login?auth=1&error=${encodeURIComponent(message)}`);
  }
  cookieStore.set(EMAIL_REGISTRATION_COOKIE, "", { path: "/login/verify", maxAge: 0 });
  await setUserSession(user.id);
  revalidatePath("/");
  revalidatePath("/profile");
  redirect("/profile?login=created");
}

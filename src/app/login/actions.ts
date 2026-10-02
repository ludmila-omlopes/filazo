"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cookies } from "next/headers";
import { beginEmailRegistration, EmailRegistrationError, EMAIL_REGISTRATION_COOKIE, EMAIL_REGISTRATION_SECONDS } from "@/lib/email-registration";
import { sendEmailRegistration } from "@/lib/email";
import { FeedbackType } from "@prisma/client";
import { ABUSE_LIMITS } from "@/lib/abuse-policy";
import { checkActionAbuse } from "@/lib/abuse-request";
import {
  hashPassword,
  canSignInWithPassword,
  normalizeEmail,
  verifyPassword,
} from "@/lib/password-auth";
import {
  getDatabaseErrorMessage,
  reportDatabaseError,
} from "@/lib/database-errors";
import { prisma } from "@/lib/prisma";
import { getRequestTranslator } from "@/lib/request-locale";
import { getSessionUserId, setUserSession } from "@/lib/session";

const emailAuthSchema = z.object({
  mode: z.enum(["signin", "signup"]),
  displayName: z.string().trim().max(48).optional(),
  email: z.string().trim().max(254).email(),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().max(128).optional(),
  terms: z.string().optional(),
});

const authFailureFeedbackSchema = z.object({
  reference: z.string().uuid(),
  details: z.string().trim().min(10).max(2000),
});

function redirectWithAuthError(message: string): never {
  redirect(`/login?auth=1&error=${encodeURIComponent(message)}`);
}

export async function emailAuthAction(formData: FormData) {
  const networkError = await checkActionAbuse([ABUSE_LIMITS.loginIp]);
  if (networkError) redirectWithAuthError(networkError);
  const { t, locale } = await getRequestTranslator();
  const existingUserId = await getSessionUserId();
  if (existingUserId) {
    redirect("/profile");
  }

  const parsed = emailAuthSchema.safeParse({
    mode: formData.get("mode"),
    displayName: formData.get("displayName") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword") || undefined,
    terms: formData.get("terms") || undefined,
  });

  if (!parsed.success) {
    redirectWithAuthError(t("auth.error.invalidEmailOrPassword"));
  }

  const email = normalizeEmail(parsed.data.email);
  const password = parsed.data.password;

  if (parsed.data.mode === "signin") {
    const limitError = await checkActionAbuse([ABUSE_LIMITS.loginEmail], email);
    if (limitError) redirectWithAuthError(limitError);
    const user = await prisma.user
      .findUnique({ where: { email } })
      .catch((error: unknown) => {
        reportDatabaseError(error, {
          operation: "email-sign-in",
          route: "/login",
        });
        redirectWithAuthError(getDatabaseErrorMessage(error, locale));
      });

    if (!user?.passwordHash) {
      redirectWithAuthError(t("auth.error.emailPasswordMismatch"));
    }
    if (!canSignInWithPassword(user)) {
      redirectWithAuthError(t("auth.error.passwordIdentityProof"));
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      redirectWithAuthError(t("auth.error.emailPasswordMismatch"));
    }

    await setUserSession(user.id);
    revalidatePath("/");
    revalidatePath("/profile");
    redirect("/profile?login=signed-in");
  }

  const displayName = parsed.data.displayName?.trim();
  if (!displayName || displayName.length < 2) {
    redirectWithAuthError(t("auth.error.displayNameLength"));
  }

  if (password !== parsed.data.confirmPassword) {
    redirectWithAuthError(t("auth.error.passwordConfirmation"));
  }

  if (parsed.data.terms !== "on") {
    redirectWithAuthError(t("auth.error.acceptTerms"));
  }

  const limitError = await checkActionAbuse([ABUSE_LIMITS.registrationEmail], email);
  if (limitError) redirectWithAuthError(limitError);
  // Reject every existing identity before doing password work.
  if (await prisma.user.findUnique({ where: { email } })) {
    redirectWithAuthError(t("auth.error.accountExists"));
  }
  try {
    const pending = await beginEmailRegistration(prisma, {
      email, displayName, passwordHash: await hashPassword(password),
    }, (token) => sendEmailRegistration({ to: email, token, locale }));
    (await cookies()).set(EMAIL_REGISTRATION_COOKIE, pending.browserProof, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/login/verify", maxAge: EMAIL_REGISTRATION_SECONDS,
    });
  } catch (error) {
    if (error instanceof EmailRegistrationError) {
      redirectWithAuthError(t(error.reason === "exists" ? "auth.error.accountExists" : "auth.error.emailDelivery"));
    }
    reportDatabaseError(error, { operation: "email-registration", route: "/login" });
    redirectWithAuthError(getDatabaseErrorMessage(error, locale));
  }
  redirect("/login?auth=1&verification=pending");
}

export async function submitAuthFailureFeedbackAction(formData: FormData) {
  const limitError = await checkActionAbuse([ABUSE_LIMITS.anonymousFeedback]);
  if (limitError) redirectWithAuthError(limitError);
  const parsed = authFailureFeedbackSchema.safeParse({
    reference: formData.get("reference"),
    details: formData.get("details"),
  });

  if (!parsed.success) {
    const reference = String(formData.get("reference") ?? "");
    const suffix = /^[0-9a-f-]{36}$/i.test(reference)
      ? `&ref=${encodeURIComponent(reference)}`
      : "";
    redirect(`/login?auth=1&feedback=invalid${suffix}`);
  }

  await prisma.feedback.create({
    data: {
      type: FeedbackType.BUG,
      title: "Google sign-in failed",
      details: `${parsed.data.details}\n\nSupport reference: ${parsed.data.reference}`,
    },
  });

  revalidatePath("/admin/feedback");
  redirect("/login?auth=1&feedback=sent");
}

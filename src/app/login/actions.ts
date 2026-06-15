"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from "@/lib/password-auth";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, setUserSession } from "@/lib/session";

const emailAuthSchema = z.object({
  mode: z.enum(["signin", "signup"]),
  displayName: z.string().trim().max(48).optional(),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().max(128).optional(),
  terms: z.string().optional(),
});

function redirectWithAuthError(message: string): never {
  redirect(`/login?auth=1&error=${encodeURIComponent(message)}`);
}

export async function emailAuthAction(formData: FormData) {
  const existingUserId = await getSessionUserId();
  if (existingUserId) {
    redirect("/profile");
  }

  const parsed = emailAuthSchema.safeParse({
    mode: formData.get("mode"),
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    terms: formData.get("terms"),
  });

  if (!parsed.success) {
    redirectWithAuthError(
      "Use a valid email and a password with at least 8 characters.",
    );
  }

  const email = normalizeEmail(parsed.data.email);
  const password = parsed.data.password;

  if (parsed.data.mode === "signin") {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      redirectWithAuthError("No filazo password account exists for that email.");
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      redirectWithAuthError("Email or password did not match.");
    }

    await setUserSession(user.id);
    revalidatePath("/");
    revalidatePath("/profile");
    redirect("/profile?login=signed-in");
  }

  const displayName = parsed.data.displayName?.trim();
  if (!displayName || displayName.length < 2) {
    redirectWithAuthError("Choose a profile name with 2 to 48 characters.");
  }

  if (password !== parsed.data.confirmPassword) {
    redirectWithAuthError("Password confirmation did not match.");
  }

  if (parsed.data.terms !== "on") {
    redirectWithAuthError("Accept the terms before creating an account.");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser?.passwordHash) {
    redirectWithAuthError("A filazo account already exists for that email.");
  }

  const passwordHash = await hashPassword(password);
  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          displayName: existingUser.displayName ?? displayName,
          passwordHash,
        },
      })
    : await prisma.user.create({
        data: {
          displayName,
          email,
          passwordHash,
        },
      });

  await setUserSession(user.id);
  revalidatePath("/");
  revalidatePath("/profile");
  redirect("/profile?login=created");
}

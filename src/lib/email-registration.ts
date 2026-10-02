import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export const EMAIL_REGISTRATION_COOKIE = "filazo-email-registration";
export const EMAIL_REGISTRATION_SECONDS = 30 * 60;

export class EmailRegistrationError extends Error {
  readonly reason: "exists" | "invalid" | "delivery";
  constructor(reason: "exists" | "invalid" | "delivery") {
    super(`Email registration ${reason}.`);
    this.reason = reason;
  }
}

export function hashRegistrationProof(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function validRegistrationProof(value: string | undefined): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** Delivery failures revoke only this attempt, never a newer pending request. */
export async function beginEmailRegistration(db: PrismaClient, input: {
  email: string; displayName: string; passwordHash: string;
}, send: (token: string) => Promise<{ sent: boolean }>) {
  if (await db.user.findUnique({ where: { email: input.email } })) {
    throw new EmailRegistrationError("exists");
  }
  const token = randomBytes(32).toString("base64url");
  const browserProof = randomBytes(32).toString("base64url");
  const tokenHash = hashRegistrationProof(token);
  const data = {
    ...input, tokenHash, browserHash: hashRegistrationProof(browserProof),
    expiresAt: new Date(Date.now() + EMAIL_REGISTRATION_SECONDS * 1000),
  };
  await db.pendingEmailRegistration.upsert({
    where: { email: input.email }, create: data, update: data,
  });
  try {
    if (!(await send(token)).sent) throw new EmailRegistrationError("delivery");
  } catch {
    await db.pendingEmailRegistration.deleteMany({ where: { email: input.email, tokenHash } });
    throw new EmailRegistrationError("delivery");
  }
  return { browserProof };
}

/** Delete claims the proof under a row lock; rollback restores it if creation loses a race. */
export async function confirmEmailRegistration(db: PrismaClient, token: string, browserProof?: string) {
  if (!validRegistrationProof(token) || !validRegistrationProof(browserProof)) {
    throw new EmailRegistrationError("invalid");
  }
  const tokenHash = hashRegistrationProof(token);
  const browserHash = hashRegistrationProof(browserProof);
  try {
    return await db.$transaction(async (tx) => {
      const where = { tokenHash, browserHash, expiresAt: { gt: new Date() } };
      const pending = await tx.pendingEmailRegistration.findFirst({ where });
      if (!pending) throw new EmailRegistrationError("invalid");
      const claim = await tx.pendingEmailRegistration.deleteMany({ where: { ...where, id: pending.id } });
      if (claim.count !== 1) throw new EmailRegistrationError("invalid");
      if (await tx.user.findUnique({ where: { email: pending.email } })) {
        throw new EmailRegistrationError("exists");
      }
      return tx.user.create({ data: {
        email: pending.email, displayName: pending.displayName,
        passwordHash: pending.passwordHash, passwordVerifiedAt: new Date(),
      } });
    });
  } catch (error) {
    // PostgreSQL has rolled back the failed transaction. Never continue inside it.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new EmailRegistrationError("exists");
    }
    throw error;
  }
}

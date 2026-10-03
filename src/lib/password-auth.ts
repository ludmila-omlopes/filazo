import crypto from "node:crypto";
import { promisify } from "node:util";
import { isAdminEmail } from "@/lib/beta-access";

export function canSignInWithPassword(user: { email: string | null; passwordHash: string | null; passwordVerifiedAt: Date | null; googleSubject: string | null; youtubeSubject: string | null }) {
  if (!user.passwordHash) return false;
  if (user.passwordVerifiedAt) return true;
  return !user.googleSubject && !user.youtubeSubject && !isAdminEmail(user.email);
}

const scryptAsync = promisify(crypto.scrypt);
const PASSWORD_PREFIX = "scrypt";
const KEY_LENGTH = 64;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const key = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  return `${PASSWORD_PREFIX}:${salt}:${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [prefix, salt, encodedKey] = passwordHash.split(":");
  if (prefix !== PASSWORD_PREFIX || !salt || !encodedKey) {
    return false;
  }

  const expectedKey = Buffer.from(encodedKey, "base64url");
  const actualKey = (await scryptAsync(password, salt, expectedKey.length)) as Buffer;

  return (
    actualKey.length === expectedKey.length &&
    crypto.timingSafeEqual(actualKey, expectedKey)
  );
}

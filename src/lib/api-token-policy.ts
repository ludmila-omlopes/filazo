import { createHash, randomBytes } from "node:crypto";
import { UserGameStatus } from "@prisma/client";

export const API_TOKEN_PREFIX = "flz_";
export const API_TOKEN_NAME_MAX_LENGTH = 60;
export const API_TOKENS_PER_USER = 5;
export const LIBRARY_API_DEFAULT_LIMIT = 50;
export const LIBRARY_API_MAX_LIMIT = 100;

const TOKEN_PATTERN = /^flz_[A-Za-z0-9_-]{43}$/;
const CURSOR_PATTERN = /^[a-z0-9]{1,64}$/i;

export function createApiTokenSecret() {
  // 32 random bytes: high entropy, so a fast hash is enough to store it.
  const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashApiToken(token), prefix: token.slice(0, 12) };
}

export function hashApiToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function readBearerToken(header: string | null) {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match && TOKEN_PATTERN.test(match[1]) ? match[1] : null;
}

export function normalizeApiTokenName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  return name && name.length <= API_TOKEN_NAME_MAX_LENGTH ? name : null;
}

export function toApiStatus(status: UserGameStatus) {
  return status.toLowerCase();
}

export type LibraryApiQuery = {
  statuses: UserGameStatus[] | null;
  limit: number;
  cursor: string | null;
};

export function parseLibraryApiQuery(
  params: URLSearchParams,
): { ok: true; query: LibraryApiQuery } | { ok: false; error: string } {
  let statuses: UserGameStatus[] | null = null;
  const rawStatus = params.get("status");
  if (rawStatus !== null) {
    const known = new Set<string>(Object.values(UserGameStatus));
    statuses = [];
    for (const value of rawStatus.split(",")) {
      const status = value.trim().toUpperCase();
      if (!known.has(status)) {
        return { ok: false, error: `Unknown status "${value.trim()}".` };
      }
      statuses.push(status as UserGameStatus);
    }
  }

  let limit = LIBRARY_API_DEFAULT_LIMIT;
  const rawLimit = params.get("limit");
  if (rawLimit !== null) {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > LIBRARY_API_MAX_LIMIT) {
      return { ok: false, error: `limit must be an integer from 1 to ${LIBRARY_API_MAX_LIMIT}.` };
    }
  }

  const cursor = params.get("cursor");
  if (cursor !== null && !CURSOR_PATTERN.test(cursor)) {
    return { ok: false, error: "Invalid cursor." };
  }

  return { ok: true, query: { statuses: statuses ? [...new Set(statuses)] : null, limit, cursor } };
}

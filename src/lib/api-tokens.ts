import { Prisma } from "@prisma/client";
import {
  API_TOKENS_PER_USER,
  createApiTokenSecret,
  hashApiToken,
  readBearerToken,
} from "./api-token-policy";
import { prisma } from "./prisma";

const LAST_USED_RESOLUTION_MS = 60 * 60 * 1000;

export type ApiTokenSummary = {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

export function listApiTokens(userId: string): Promise<ApiTokenSummary[]> {
  return prisma.apiToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
    take: API_TOKENS_PER_USER,
  });
}

export async function createApiToken(userId: string, name: string) {
  const secret = createApiTokenSecret();
  try {
    // Serializable keeps concurrent requests from going past the per-user cap.
    return await prisma.$transaction(async (tx) => {
      if (await tx.apiToken.count({ where: { userId } }) >= API_TOKENS_PER_USER) {
        return { result: "limit" } as const;
      }
      await tx.apiToken.create({
        data: { userId, name, tokenHash: secret.tokenHash, prefix: secret.prefix },
      });
      return { result: "created", token: secret.token } as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    return { result: "error" } as const;
  }
}

export async function revokeApiToken(userId: string, tokenId: string) {
  const { count } = await prisma.apiToken.deleteMany({ where: { id: tokenId, userId } });
  return count > 0;
}

/** Resolves a read-only API key to its owner, or null when it is missing or revoked. */
export async function authenticateApiToken(authorization: string | null) {
  const token = readBearerToken(authorization);
  if (!token) return null;
  const record = await prisma.apiToken.findUnique({
    where: { tokenHash: hashApiToken(token) },
    select: { id: true, userId: true, lastUsedAt: true },
  });
  if (!record) return null;

  // Coarse timestamp: enough to spot unused keys without a write per request.
  const staleBefore = new Date(Date.now() - LAST_USED_RESOLUTION_MS);
  if (!record.lastUsedAt || record.lastUsedAt < staleBefore) {
    await prisma.apiToken.updateMany({
      where: { id: record.id, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: staleBefore } }] },
      data: { lastUsedAt: new Date() },
    }).catch(() => undefined);
  }
  return { tokenId: record.id, userId: record.userId };
}

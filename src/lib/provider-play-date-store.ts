import { Prisma, type ExternalProvider } from "@prisma/client";
import { prisma } from "./prisma";
import { providerPlayDates } from "./provider-play-dates";

// Called by authenticated sync workflows, not by page loads. Holding a shared
// lock on the account prevents concurrent reassignment while writing history.
export async function recordProviderPlayDates(input: { userId: string; gameId: string; accountId: string; provider: ExternalProvider; rawData: unknown }, db: Prisma.TransactionClient = prisma) {
  const write = async (tx: Prisma.TransactionClient) => {
    const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema") || "public";
    const accountTable = Prisma.raw(`"${schema.replaceAll('"', '""')}"."ExternalAccount"`);
    const accounts = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM ${accountTable} WHERE id = ${input.accountId} AND "userId" = ${input.userId} AND provider::text = ${input.provider} FOR SHARE`;
    if (!accounts.length) throw new Error("Platform account ownership changed. Reconnect before syncing.");
    const previous = await tx.userGameEntry.findMany({ where: { userId: input.userId, gameId: input.gameId }, select: { provider: true, rawData: true } });
    const dates = [...providerPlayDates(input.provider, input.rawData), ...previous.flatMap(entry => providerPlayDates(entry.provider, entry.rawData))];
    if (!dates.length) return 0;
    const result = await tx.userGamePlayDate.createMany({ data: dates.map(date => ({ ...date, gameId: input.gameId, userId: input.userId })), skipDuplicates: true });
    return result.count;
  };
  return db === prisma ? prisma.$transaction(write, { timeout: 15000 }) : write(db);
}

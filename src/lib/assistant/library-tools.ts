import type { Prisma } from "@prisma/client";
import { UserGameStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isEntryFinished } from "../time-estimates.ts";
import { readStringList } from "./scoring.ts";

/**
 * Read-only tool layer over a user's library, shared by the player-profile
 * agent and the library chat. Every function returns a minimized projection
 * of `UserGameEntry` and canonical `Game` metadata; no secrets, tokens, or
 * provider account IDs are ever included.
 */

export type LibraryEntry = Prisma.UserGameEntryGetPayload<{
  include: { game: true };
}>;

export async function loadLibraryEntries(userId: string) {
  return prisma.userGameEntry.findMany({
    where: { userId },
    include: { game: true },
  });
}

export function hasUserFeedback(entry: LibraryEntry) {
  return Boolean(
    entry.notes || entry.abandonReason || entry.userIntent || entry.isFavorite,
  );
}

function toGameSummary(entry: LibraryEntry) {
  return {
    title: entry.game.name,
    slug: entry.game.slug,
    status: entry.status,
    genres: readStringList(entry.game.genres).slice(0, 4),
    platforms: [
      ...new Set(
        [entry.platformName, ...readStringList(entry.game.platforms)].filter(
          (item): item is string => Boolean(item),
        ),
      ),
    ].slice(0, 4),
    playtimeMinutes: entry.playtimeMinutes,
    achievementPercent: entry.completionPercent,
    finished: isEntryFinished(entry),
    lastPlayedAt: entry.lastPlayedAt?.toISOString() ?? null,
    isFavorite: entry.isFavorite,
    aggregatedRating: entry.game.aggregatedRating,
    hltbMainStoryMinutes: entry.game.hltbMainStoryMinutes,
  };
}

export function runLibraryOverview(entries: LibraryEntry[]) {
  const statusCounts: Record<string, number> = {};
  for (const entry of entries) {
    statusCounts[entry.status] = (statusCounts[entry.status] ?? 0) + 1;
  }

  const playedEntries = entries.filter(
    (entry) => (entry.playtimeMinutes ?? 0) > 0,
  );
  const genreMinutes = new Map<string, number>();
  for (const entry of playedEntries) {
    for (const genre of readStringList(entry.game.genres)) {
      genreMinutes.set(
        genre,
        (genreMinutes.get(genre) ?? 0) + (entry.playtimeMinutes ?? 0),
      );
    }
  }

  const platformCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const platform of [
      entry.platformName,
      ...readStringList(entry.game.platforms),
    ]) {
      if (platform) {
        platformCounts.set(platform, (platformCounts.get(platform) ?? 0) + 1);
      }
    }
  }

  return {
    totalEntries: entries.length,
    statusCounts,
    favoriteCount: entries.filter((entry) => entry.isFavorite).length,
    entriesWithFeedback: entries.filter(hasUserFeedback).length,
    totalPlaytimeMinutes: playedEntries.reduce(
      (total, entry) => total + (entry.playtimeMinutes ?? 0),
      0,
    ),
    playedGameCount: playedEntries.length,
    topGenresByPlaytime: [...genreMinutes.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([genre, minutes]) => ({ genre, minutes })),
    topPlatforms: [...platformCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([platform, count]) => ({ platform, count })),
  };
}

export const listGamesArgsSchema = z.object({
  status: z.enum(UserGameStatus).nullable().optional(),
  sortBy: z
    .enum(["playtime", "recent", "rating", "recently_added"])
    .nullable()
    .optional(),
  limit: z.number().int().min(1).max(60).nullable().optional(),
});

export function runListGames(
  entries: LibraryEntry[],
  args: z.infer<typeof listGamesArgsSchema>,
) {
  const filtered = args.status
    ? entries.filter((entry) => entry.status === args.status)
    : entries;
  const sortBy = args.sortBy ?? "playtime";
  const sorted = [...filtered].sort((left, right) => {
    switch (sortBy) {
      case "recent":
        return (
          (right.lastPlayedAt?.getTime() ?? 0) -
          (left.lastPlayedAt?.getTime() ?? 0)
        );
      case "rating":
        return (
          (right.game.aggregatedRating ?? 0) - (left.game.aggregatedRating ?? 0)
        );
      case "recently_added":
        return right.createdAt.getTime() - left.createdAt.getTime();
      default:
        return (right.playtimeMinutes ?? 0) - (left.playtimeMinutes ?? 0);
    }
  });

  return {
    totalMatching: filtered.length,
    games: sorted.slice(0, args.limit ?? 30).map(toGameSummary),
  };
}

export function runPlayerFeedback(entries: LibraryEntry[]) {
  const feedbackEntries = entries.filter(hasUserFeedback);

  return {
    totalWithFeedback: feedbackEntries.length,
    feedback: feedbackEntries.slice(0, 60).map((entry) => ({
      title: entry.game.name,
      slug: entry.game.slug,
      status: entry.status,
      isFavorite: entry.isFavorite,
      playtimeMinutes: entry.playtimeMinutes,
      review: entry.notes,
      abandonReason: entry.abandonReason,
      statedIntent: entry.userIntent,
      desiredSessionMinutes: entry.desiredSessionMin,
    })),
  };
}

export function runGenreStats(entries: LibraryEntry[]) {
  const stats = new Map<
    string,
    {
      gameCount: number;
      playtimeMinutes: number;
      completedCount: number;
      abandonedCount: number;
      favoriteCount: number;
    }
  >();

  for (const entry of entries) {
    for (const genre of readStringList(entry.game.genres)) {
      const stat = stats.get(genre) ?? {
        gameCount: 0,
        playtimeMinutes: 0,
        completedCount: 0,
        abandonedCount: 0,
        favoriteCount: 0,
      };
      stat.gameCount += 1;
      stat.playtimeMinutes += entry.playtimeMinutes ?? 0;
      if (isEntryFinished(entry)) {
        stat.completedCount += 1;
      }
      if (entry.abandonedAt) {
        stat.abandonedCount += 1;
      }
      if (entry.isFavorite) {
        stat.favoriteCount += 1;
      }
      stats.set(genre, stat);
    }
  }

  return {
    genres: [...stats.entries()]
      .sort((left, right) => right[1].playtimeMinutes - left[1].playtimeMinutes)
      .slice(0, 20)
      .map(([genre, stat]) => ({ genre, ...stat })),
  };
}

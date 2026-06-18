import { ExternalProvider, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SteamReviewReference = {
  appId: string;
  url: string;
};

type SteamReview = SteamReviewReference & {
  body: string | null;
  recommended: boolean | null;
  reviewedAt: Date | null;
  language: string | null;
  rawData: Record<string, unknown>;
};

export type ReviewSyncResult = {
  importedCount: number;
  skippedCount: number;
  unsupportedProviders: ExternalProvider[];
};

function decodeHtml(value: string) {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ");
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function parseSteamDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function fetchSteamReviewReferences(steamId: string) {
  const references = new Map<string, SteamReviewReference>();

  for (let page = 1; page <= 3; page += 1) {
    const url = `https://steamcommunity.com/profiles/${steamId}/recommended/?p=${page}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      break;
    }

    const html = await response.text();
    const matches = html.matchAll(
      /href="(https:\/\/steamcommunity\.com\/(?:id|profiles)\/[^"]+\/recommended\/(\d+)\/?)"/g,
    );
    let foundOnPage = 0;

    for (const match of matches) {
      const reviewUrl = match[1];
      const appId = match[2];
      if (!appId || !reviewUrl || references.has(appId)) {
        continue;
      }

      references.set(appId, { appId, url: reviewUrl });
      foundOnPage += 1;
    }

    if (foundOnPage === 0) {
      break;
    }
  }

  return [...references.values()];
}

function parseSteamReviewPage(reference: SteamReviewReference, html: string): SteamReview {
  const contentMatch = html.match(
    /<div[^>]+class="[^"]*review_area_content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  );
  const postedMatch = html.match(/Posted:\s*<\/span>\s*([^<]+)/i);
  const languageMatch = html.match(/<html[^>]+lang="([^"]+)"/i);
  const notRecommended = /Not Recommended/i.test(html);
  const recommended = /Recommended/i.test(html)
    ? !notRecommended
    : null;

  return {
    ...reference,
    body: contentMatch?.[1]
      ? stripHtml(contentMatch[1])
      : null,
    recommended,
    reviewedAt: parseSteamDate(postedMatch?.[1]?.trim() ?? null),
    language: languageMatch?.[1] ?? null,
    rawData: {
      appId: reference.appId,
      sourceUrl: reference.url,
      importedFrom: "steam-community-recommended",
    },
  };
}

async function fetchSteamReview(reference: SteamReviewReference) {
  const response = await fetch(reference.url, { cache: "no-store" });
  if (!response.ok) {
    return {
      ...reference,
      body: null,
      recommended: null,
      reviewedAt: null,
      language: null,
      rawData: {
        appId: reference.appId,
        sourceUrl: reference.url,
        importError: `Steam review page returned ${response.status}.`,
      },
    } satisfies SteamReview;
  }

  return parseSteamReviewPage(reference, await response.text());
}

export async function syncUserReviews(userId: string): Promise<ReviewSyncResult> {
  const steamAccount = await prisma.externalAccount.findFirst({
    where: {
      userId,
      provider: ExternalProvider.STEAM,
    },
  });

  let importedCount = 0;
  let skippedCount = 0;
  const unsupportedProviders = [
    ExternalProvider.PLAYSTATION,
    ExternalProvider.XBOX,
  ];

  if (!steamAccount) {
    return {
      importedCount,
      skippedCount,
      unsupportedProviders,
    };
  }

  const references = await fetchSteamReviewReferences(
    steamAccount.providerAccountId,
  );
  if (!references.length) {
    return {
      importedCount,
      skippedCount,
      unsupportedProviders,
    };
  }

  const entries = await prisma.userGameEntry.findMany({
    where: { userId },
    include: {
      game: {
        include: {
          providerLinks: {
            where: {
              provider: ExternalProvider.STEAM,
            },
          },
        },
      },
    },
  });
  const entryBySteamAppId = new Map(
    entries.flatMap((entry) =>
      entry.game.providerLinks.map((link) => [link.providerGameId, entry] as const),
    ),
  );

  for (const reference of references) {
    const entry = entryBySteamAppId.get(reference.appId);
    if (!entry) {
      skippedCount += 1;
      continue;
    }

    const review = await fetchSteamReview(reference);
    await prisma.userGameReview.upsert({
      where: {
        provider_externalReviewId: {
          provider: ExternalProvider.STEAM,
          externalReviewId: `${steamAccount.providerAccountId}:${reference.appId}`,
        },
      },
      update: {
        body: review.body,
        gameId: entry.gameId,
        language: review.language,
        recommended: review.recommended,
        reviewedAt: review.reviewedAt,
        sourceUrl: review.url,
        updatedOnProviderAt: new Date(),
        userGameEntryId: entry.id,
        userId,
        rawData: review.rawData as Prisma.InputJsonValue,
      },
      create: {
        userId,
        userGameEntryId: entry.id,
        gameId: entry.gameId,
        provider: ExternalProvider.STEAM,
        externalReviewId: `${steamAccount.providerAccountId}:${reference.appId}`,
        body: review.body,
        language: review.language,
        recommended: review.recommended,
        reviewedAt: review.reviewedAt,
        sourceUrl: review.url,
        updatedOnProviderAt: new Date(),
        rawData: review.rawData as Prisma.InputJsonValue,
      },
    });
    importedCount += 1;
  }

  return {
    importedCount,
    skippedCount,
    unsupportedProviders,
  };
}

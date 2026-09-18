import { z } from "zod";

const STEAM_REVIEWS_TIMEOUT_MS = 12_000;
const MAX_REVIEW_BODY_LENGTH = 1_800;
const MAX_REVIEWS = 6;
const steamReviewLanguageSchema = z.enum(["english", "brazilian"]);

export type SteamReviewLanguage = z.infer<typeof steamReviewLanguageSchema>;
export type SteamReviewsLocale = "en" | "pt-BR";

export function steamReviewLanguage(locale: SteamReviewsLocale): SteamReviewLanguage {
  return locale === "pt-BR" ? "brazilian" : "english";
}

const steamReviewSchema = z.object({
  id: z.string().min(1).max(80),
  author: z.string().min(1).max(160),
  profileUrl: z.string().url().max(500).nullable(),
  body: z.string().min(1).max(MAX_REVIEW_BODY_LENGTH),
  language: z.string().min(1).max(40).nullable(),
  recommended: z.boolean().nullable(),
  votesUp: z.number().int().nonnegative().max(100_000_000),
  weightedVoteScore: z.number().finite().nonnegative().max(1),
  commentCount: z.number().int().nonnegative().max(100_000_000),
  playtimeMinutes: z.number().int().nonnegative().max(100_000_000).nullable(),
  reviewedAt: z.string().datetime().nullable(),
  url: z.string().url().max(1_000),
});

const steamReviewSummarySchema = z.object({
  reviewScore: z.number().int().min(0).max(10).nullable(),
  reviewScoreDesc: z.string().max(120).nullable(),
  totalReviews: z.number().int().nonnegative().nullable(),
  totalPositive: z.number().int().nonnegative().nullable(),
  totalNegative: z.number().int().nonnegative().nullable(),
});

const steamReviewsSnapshotSchema = z.object({
  appId: z.string().regex(/^\d+$/),
  language: steamReviewLanguageSchema,
  summary: steamReviewSummarySchema,
  reviews: z.array(steamReviewSchema).max(MAX_REVIEWS),
  checkedAt: z.string().datetime(),
});

export type SteamReview = z.infer<typeof steamReviewSchema>;
export type SteamReviewSummary = z.infer<typeof steamReviewSummarySchema>;
export type SteamReviewsSnapshot = z.infer<typeof steamReviewsSnapshotSchema>;
export type SteamReviewsResult = SteamReviewsSnapshot & {
  refreshing?: boolean;
  unavailable?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function integerValue(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(?:nbsp|amp|quot|apos|lt|gt);/gi, (entity) => ({
      "&nbsp;": " ",
      "&amp;": "&",
      "&quot;": '"',
      "&apos;": "'",
      "&lt;": "<",
      "&gt;": ">",
    })[entity.toLowerCase()] ?? " ");
}

export function cleanSteamReview(value: string) {
  return decodeHtml(value
    .replace(/\[url=[^\]]*\]([\s\S]*?)\[\/url\]/gi, "$1")
    .replace(/\[\*\]/gi, "\n• ")
    .replace(/\[\/?(?:b|i|u|strike|spoiler|code|noparse|table|tr|td|th)\]/gi, "")
    .replace(/\[\/?(?:h[1-6]|quote|list|olist)\]/gi, "\n")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_REVIEW_BODY_LENGTH);
}

function parseSteamTimestamp(value: unknown) {
  const seconds = integerValue(value);
  if (seconds === null) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseReview(value: unknown): SteamReview | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.recommendationid);
  const author = isRecord(value.author) ? value.author : null;
  const body = stringValue(value.review) ? cleanSteamReview(value.review as string) : "";
  if (!id || !author || !body) return null;
  const steamId = stringValue(author.steamid);
  const reviewUrl = steamId
    ? `https://steamcommunity.com/profiles/${encodeURIComponent(steamId)}/recommended/${encodeURIComponent(id)}/`
    : `https://steamcommunity.com/appreviews/${encodeURIComponent(id)}`;
  const reviewedAt = parseSteamTimestamp(value.timestamp_created);
  return {
    id,
    author: stringValue(author.personaname) ?? "Steam user",
    profileUrl: steamId ? `https://steamcommunity.com/profiles/${encodeURIComponent(steamId)}/` : null,
    body,
    language: stringValue(value.language),
    recommended: typeof value.voted_up === "boolean" ? value.voted_up : null,
    votesUp: integerValue(value.votes_up) ?? 0,
    weightedVoteScore: Math.min(1, numberValue(value.weighted_vote_score)),
    commentCount: integerValue(value.comment_count) ?? 0,
    playtimeMinutes: integerValue(author.playtime_at_review),
    reviewedAt,
    url: reviewUrl,
  };
}

function rankReviews(reviews: SteamReview[]) {
  return [...reviews]
    .sort((left, right) => {
      if (right.weightedVoteScore !== left.weightedVoteScore) {
        return right.weightedVoteScore - left.weightedVoteScore;
      }
      if (right.votesUp !== left.votesUp) return right.votesUp - left.votesUp;
      return (right.reviewedAt ?? "").localeCompare(left.reviewedAt ?? "");
    })
    .slice(0, MAX_REVIEWS);
}

function parseSummary(value: unknown): SteamReviewSummary {
  const summary = isRecord(value) ? value : {};
  return {
    reviewScore: integerValue(summary.review_score),
    reviewScoreDesc: stringValue(summary.review_score_desc),
    totalReviews: integerValue(summary.total_reviews),
    totalPositive: integerValue(summary.total_positive),
    totalNegative: integerValue(summary.total_negative),
  };
}

export function parseSteamReviewsResponse(
  payload: unknown,
  appId: string,
  language: SteamReviewLanguage = "english",
) {
  if (!/^\d+$/.test(appId) || !isRecord(payload) || payload.success !== 1) {
    return { appId, language, summary: parseSummary(null), reviews: [] } satisfies Omit<SteamReviewsSnapshot, "checkedAt">;
  }
  const reviews = Array.isArray(payload.reviews)
    ? payload.reviews.flatMap((review) => {
        if (!isRecord(review) || review.language !== language) return [];
        const parsed = parseReview(review);
        return parsed ? [parsed] : [];
      })
    : [];
  return {
    appId,
    language,
    summary: parseSummary(payload.query_summary),
    reviews: rankReviews(reviews),
  } satisfies Omit<SteamReviewsSnapshot, "checkedAt">;
}

export function parseSteamReviewsSnapshot(value: unknown): SteamReviewsSnapshot | null {
  const parsed = steamReviewsSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function readSteamAppId(links: Array<{ providerGameId: string; storeUrl?: string | null }>) {
  for (const link of links) {
    const fromId = /^\d+$/.test(link.providerGameId) ? link.providerGameId : null;
    const fromUrl = link.storeUrl?.match(/\/app\/(\d+)/i)?.[1] ?? null;
    const appId = fromId ?? fromUrl;
    if (appId) return appId;
  }
  return null;
}

export async function fetchSteamReviews({
  appId,
  language,
  signal,
}: {
  appId: string;
  language: SteamReviewLanguage;
  signal?: AbortSignal;
}): Promise<SteamReviewsSnapshot> {
  const url = new URL(`https://store.steampowered.com/appreviews/${encodeURIComponent(appId)}`);
  url.searchParams.set("json", "1");
  url.searchParams.set("language", language);
  url.searchParams.set("filter", "all");
  url.searchParams.set("review_type", "all");
  url.searchParams.set("purchase_type", "all");
  url.searchParams.set("num_per_page", "50");
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "Filazo-SteamReviews/1.0 (+https://filazo.app)",
    },
    signal: AbortSignal.any([AbortSignal.timeout(STEAM_REVIEWS_TIMEOUT_MS), ...(signal ? [signal] : [])]),
  });
  if (!response.ok) throw new Error(`Steam reviews returned ${response.status}.`);
  const parsed = parseSteamReviewsResponse(await response.json() as unknown, appId, language);
  return { ...parsed, checkedAt: new Date().toISOString() };
}

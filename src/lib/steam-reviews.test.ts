import assert from "node:assert/strict";
import test from "node:test";
import { cleanSteamReview, fetchSteamReviews, parseSteamReviewsResponse, readSteamAppId } from "./steam-reviews.ts";

test("cleans Steam BBCode before exposing review text", () => {
  assert.equal(
    cleanSteamReview("[h1]Great game[/h1][b]Worth it[/b][url=https://example.com]guide[/url]"),
    "Great game\nWorth itguide",
  );
});

test("keeps the most helpful public Steam reviews and summary", () => {
  const result = parseSteamReviewsResponse({
    success: 1,
    query_summary: {
      review_score: 9,
      review_score_desc: "Very Positive",
      total_reviews: 100,
      total_positive: 90,
      total_negative: 10,
    },
    reviews: [
      {
        recommendationid: "low",
        author: { steamid: "1", personaname: "Low", playtime_at_review: 60 },
        review: "A short review.",
        language: "english",
        voted_up: true,
        votes_up: 2,
        weighted_vote_score: "0.21",
        comment_count: 0,
        timestamp_created: 1_700_000_000,
      },
      {
        recommendationid: "high",
        author: { steamid: "2", personaname: "High", playtime_at_review: 120 },
        review: "[b]A useful review[/b] with context.",
        language: "brazilian",
        voted_up: true,
        votes_up: 42,
        weighted_vote_score: "0.91",
        comment_count: 3,
        timestamp_created: 1_700_000_100,
      },
    ],
  }, "123", "brazilian");

  assert.equal(result.appId, "123");
  assert.equal(result.summary.reviewScoreDesc, "Very Positive");
  assert.equal(result.reviews[0]?.id, "high");
  assert.equal(result.reviews[0]?.body, "A useful review with context.");
  assert.equal(result.reviews[0]?.votesUp, 42);
  assert.ok(result.reviews.every((review) => review.language === "brazilian"));
});

test("reads a Steam app id from provider id or store URL", () => {
  assert.equal(readSteamAppId([{ providerGameId: "1145360", storeUrl: null }]), "1145360");
  assert.equal(readSteamAppId([{ providerGameId: "app:1145360", storeUrl: "https://store.steampowered.com/app/1145360/Hades/" }]), "1145360");
  assert.equal(readSteamAppId([{ providerGameId: "app:unknown", storeUrl: null }]), null);
});

test("requests only the configured Steam review language", async (t) => {
  let requestedUrl = "";
  t.mock.method(globalThis, "fetch", async (target: string | URL | Request) => {
    requestedUrl = String(target);
    return Response.json({
      success: 1,
      query_summary: { review_score_desc: "Positive", total_reviews: 1 },
      reviews: [{
        recommendationid: "br",
        author: { steamid: "1", personaname: "Portuguese reviewer" },
        review: "Review em português.",
        language: "brazilian",
        voted_up: true,
        votes_up: 10,
        weighted_vote_score: 0.8,
      }, {
        recommendationid: "en",
        author: { steamid: "2", personaname: "English reviewer" },
        review: "English review.",
        language: "english",
        voted_up: true,
        votes_up: 20,
        weighted_vote_score: 0.9,
      }],
    });
  });

  const result = await fetchSteamReviews({ appId: "123", language: "brazilian" });
  assert.equal(new URL(requestedUrl).searchParams.get("language"), "brazilian");
  assert.deepEqual(result.reviews.map((review) => review.id), ["br"]);
  assert.equal(result.language, "brazilian");
});

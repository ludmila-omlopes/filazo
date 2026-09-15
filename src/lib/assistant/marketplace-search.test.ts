import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMarketplaceResponse } from "./marketplace-search.ts";

const input = { title: "Hades", region: "BR" as const, locale: "pt-BR" as const };

function response(content: string, urls: string[]) {
  return {
    choices: [{
      message: {
        content,
        annotations: urls.map((url) => ({
          type: "url_citation",
          url_citation: { url },
        })),
      },
    }],
  };
}

test("parses a cited subscription inclusion separately from store offers", () => {
  const url = "https://www.playstation.com/pt-br/ps-plus/games";
  const result = parseMarketplaceResponse(response(JSON.stringify({
    offers: [],
    subscriptions: [{
      service: "PlayStation Plus",
      title: "Hades",
      tier: "Extra",
      url,
      evidence: "O catálogo do plano Extra inclui Hades.",
    }],
  }), [url]), input);

  assert.equal(result.offers.length, 0);
  assert.deepEqual(result.subscriptions, [{
    service: "PlayStation Plus",
    title: "Hades",
    tier: "Extra",
    url,
    evidence: "O catálogo do plano Extra inclui Hades.",
  }]);
});

test("keeps legacy store responses compatible and rejects uncited subscription links", () => {
  const citedUrl = "https://www.playstation.com/pt-br/ps-plus";
  const result = parseMarketplaceResponse(response(JSON.stringify({
    offers: [],
    subscriptions: [{
      service: "Xbox Game Pass",
      title: "Hades",
      tier: null,
      url: "https://www.xbox.com/pt-br/games/store/hades",
      evidence: "O catálogo inclui Hades.",
    }],
  }), [citedUrl]), input);

  assert.deepEqual(result.offers, []);
  assert.deepEqual(result.subscriptions, []);

  const legacy = parseMarketplaceResponse(response(JSON.stringify({ offers: [] }), [citedUrl]), input);
  assert.deepEqual(legacy.subscriptions, []);
});

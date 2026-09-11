import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMarketplaceRequest, isSupportedStoreUrl, localizeMarketplaceUrl, marketplaceInputSchema, marketplaceSearchScopes, normalizeMarketplaceUrl, parseMarketplaceResponse, searchMarketplaces, storePageText } from "../src/lib/assistant/marketplace-search.ts";
import { getBudgetUsageFromRun } from "../src/lib/ai-budget.ts";
import { DEFAULT_AI_SETTINGS, isAiFeatureEnabled } from "../src/lib/ai-settings.ts";

const input = { title: "Grand Theft Auto VI", region: "BR", locale: "pt-BR" };
const url = "https://www.xbox.com/pt-br/games/store/grand-theft-auto-vi/game-id";
const offer = { store: "Xbox", title: input.title, edition: "Standard", platform: "Xbox Series X|S", url, availability: "preorder", purchaseType: "digital", price: 449.9, currency: "BRL", evidence: "A loja aceita pré-encomendas." };
function response(offers, sources = offers.map((item) => item.url)) {
  return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ offers }), annotations: sources.map((url) => ({ type: "url_citation", url_citation: { url } })) } }] };
}

test("accepts a sourced preorder and preserves regional price", () => {
  const result = parseMarketplaceResponse(response([offer]), input);
  assert.equal(result.offers[0].availability, "preorder");
  assert.equal(result.offers[0].price, 449.9);
  assert.equal(result.region, "BR");
  assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
});

test("announcement, unknown delivery, unavailable and foreign-currency offers cannot fill price", () => {
  for (const change of [{ availability: "announced" }, { availability: "unknown" }, { availability: "unavailable" }, { currency: "USD" }, { purchaseType: "unknown" }]) {
    const result = parseMarketplaceResponse(response([{ ...offer, ...change }]), input);
    assert.equal(result.offers[0].price, null);
    assert.equal(result.offers[0].currency, null);
  }
  assert.equal(parseMarketplaceResponse(response([{ ...offer, price: 0 }]), input).offers[0].price, 0);
});

test("drops invented product URLs even when their store domain has a citation", () => {
  const invented = { ...offer, url: `${url}/invented` };
  const result = parseMarketplaceResponse(response([offer, invented], [url]), input);
  assert.deepEqual(result.offers.map((item) => item.url), [url]);
  assert.throws(() => parseMarketplaceResponse(response([invented], [url]), input), /citations/);
});

test("rejects unsafe URLs including provider-cited local destinations", () => {
  for (const unsafe of ["javascript:alert(1)", "http://store.com/game", "https://127.0.0.1/game", "https://localhost/game", "https://server.internal/game", "https://user:pass@store.com/game", "https://[::1]/game", "https://store.com:3000/game"]) {
    assert.equal(normalizeMarketplaceUrl(unsafe), null);
  }
  assert.throws(() => parseMarketplaceResponse(response([{ ...offer, url: "https://127.0.0.1/game" }]), input), /evidence/);
});

test("normalizes tracking without dropping edition query parameters and deduplicates", () => {
  const tracked = `${url}?edition=ultimate&utm_source=search#details`;
  assert.equal(normalizeMarketplaceUrl(tracked), `${url}?edition=ultimate`);
  const result = parseMarketplaceResponse(response([offer, { ...offer, url: `${url}?utm_source=ai` }]), input);
  assert.equal(result.offers.length, 1);
});

test("localizes only known product paths, without inventing product IDs", () => {
  assert.equal(localizeMarketplaceUrl("https://store.playstation.com/en-us/concept/10000730?smcid=tracking", "BR"), "https://store.playstation.com/pt-br/concept/10000730");
  assert.equal(localizeMarketplaceUrl("https://www.xbox.com/en-US/games/store/game/ABC/0017", "PT"), "https://www.xbox.com/pt-pt/games/store/game/ABC/0017");
  assert.equal(localizeMarketplaceUrl("https://www.amazon.com/en-us/product", "BR"), "https://www.amazon.com/en-us/product");
  assert.equal(localizeMarketplaceUrl("https://store.playstation.com/en-us/", "BR"), "https://store.playstation.com/en-us");
  const regional = { ...offer, url: "https://store.playstation.com/pt-br/concept/10000730" };
  const parsed = parseMarketplaceResponse(response([regional], ["https://store.playstation.com/en-us/concept/10000730"]), input);
  assert.equal(parsed.offers[0].url, "https://store.playstation.com/en-us/concept/10000730");
  assert.throws(() => parseMarketplaceResponse(response([regional], ["https://store.playstation.com/en-us/concept/OTHER"]), input), /citations/);
});

test("discard unrelated games and upgrades before creating unconfirmed links", () => {
  for (const title of ["Grand Theft Timeline", "Grand Theft Auto V", "Grand Theft Auto VI: Melhoria Ultimate Edition"]) {
    assert.deepEqual(parseMarketplaceResponse(response([{ ...offer, title }]), input).offers, []);
  }
  assert.equal(parseMarketplaceResponse(response([{ ...offer, title: "Grand Theft Auto VI: Ultimate Edition" }]), input).offers.length, 1);
});

test("filters account access and gift-card promotions", () => {
  for (const purchaseType of ["account", "gift_card"]) {
    assert.deepEqual(parseMarketplaceResponse(response([{ ...offer, purchaseType }]), input).offers, []);
  }
});

test("extracts OpenAI completed search sources and citations", () => {
  const payload = {
    status: "completed",
    output: [
      { type: "web_search_call", status: "completed", action: { type: "search", sources: [{ type: "url", url }] } },
      { type: "message", content: [{ type: "output_text", text: JSON.stringify({ offers: [offer] }), annotations: [{ type: "url_citation", url }] }] },
    ],
  };
  assert.equal(parseMarketplaceResponse(payload, input).offers.length, 1);
  assert.throws(() => parseMarketplaceResponse({ ...payload, status: "incomplete" }, input), /incomplete/);
});

test("distinguishes empty grounded searches from provider failures and malformed output", () => {
  assert.deepEqual(parseMarketplaceResponse(response([], ["https://www.rockstargames.com/VI"]), input).offers, []);
  assert.throws(() => parseMarketplaceResponse(response([], []), input), /evidence/);
  assert.throws(() => parseMarketplaceResponse(response([{ ...offer, price: -1 }]), input));
  assert.throws(() => parseMarketplaceResponse({ choices: [{ message: { content: "not json" } }] }, input));
  const truncated = response([offer]);
  truncated.choices[0].finish_reason = "length";
  assert.throws(() => parseMarketplaceResponse(truncated, input), /incomplete/);
});

test("validates query limits and region before any paid request", () => {
  assert.equal(marketplaceInputSchema.safeParse({ ...input, title: " " }).success, false);
  assert.equal(marketplaceInputSchema.safeParse({ ...input, title: "x".repeat(161) }).success, false);
  assert.equal(marketplaceInputSchema.safeParse({ ...input, region: "XX" }).success, false);
});

test("keeps offers across platforms even with a legacy Xbox filter", () => {
  const playstation = { ...offer, store: "PlayStation Store", platform: "PS5", url: "https://store.playstation.com/pt-br/concept/gta-vi" };
  const legacyInput = { ...input, platformName: "Xbox Series X|S" };
  assert.deepEqual(marketplaceInputSchema.parse(legacyInput), input);
  const result = parseMarketplaceResponse(response([offer, playstation]), legacyInput);
  assert.deepEqual(result.offers.map((item) => item.platform), ["Xbox Series X|S", "PS5"]);
  for (const provider of ["openai", "openrouter"]) {
    const config = { apiKey: "test", baseUrl: "https://api.example.com/v1", model: "test", provider };
    assert.deepEqual(buildMarketplaceRequest(legacyInput, config), buildMarketplaceRequest(input, config));
  }
});

test("requires live search with citations for both configured providers", () => {
  const config = { apiKey: "test", baseUrl: "https://api.openai.com/v1", model: "configured-model", provider: "openai" };
  const direct = buildMarketplaceRequest(input, config);
  assert.equal(direct.body.model, config.model);
  assert.equal(direct.body.tool_choice, "required");
  assert.equal(direct.body.tools[0].external_web_access, true);
  assert.equal(direct.body.tools[0].user_location.country, "BR");
  assert.deepEqual(direct.body.include, ["web_search_call.action.sources"]);
  const routed = buildMarketplaceRequest(input, { ...config, baseUrl: "https://openrouter.ai/api/v1", provider: "openrouter" });
  assert.equal(routed.endpoint, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(routed.body.plugins[0].engine, "exa");
  assert.equal(routed.body.plugins[0].max_results, 4);
  assert.ok(routed.body.plugins[0].include_domains.includes("store.steampowered.com"));
  assert.ok(direct.body.tools[0].filters.allowed_domains.includes("xbox.com"));
});

test("provider HTTP failures and cancellation do not become empty results", async (t) => {
  const config = { apiKey: "test", baseUrl: "https://api.openai.com/v1", model: "test", provider: "openai" };
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    options.signal.throwIfAborted();
    return new Response("private provider error", { status: 429 });
  });
  await assert.rejects(searchMarketplaces(input, config), /429/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(searchMarketplaces(input, config, controller.signal), { name: "AbortError" });
});

test("marketplace calls use the summary toggle and participate in spend accounting", () => {
  assert.equal(isAiFeatureEnabled({ ...DEFAULT_AI_SETTINGS, assistantSummaryEnabled: false }, "assistant_marketplace"), false);
  const usage = getBudgetUsageFromRun({ inputSummary: { kind: "ai_budget", feature: "assistant_marketplace", countedCalls: 1, estimatedUsage: { totalTokens: 16000, usd: 0.06 } } });
  assert.equal(usage.feature, "assistant_marketplace");
  assert.equal(usage.usd, 0.06);
  assert.equal(usage.calls, 1);
});

test("page retrieval only accepts supported storefronts and strips executable HTML", () => {
  assert.equal(isSupportedStoreUrl(url), true);
  assert.equal(isSupportedStoreUrl("https://www.amazon.com.br/game"), true);
  assert.equal(isSupportedStoreUrl("https://xbox.com.attacker.com/game"), false);
  assert.equal(isSupportedStoreUrl("https://random-store.com/game"), false);
  assert.equal(storePageText('<head>hidden</head><script>fake price</script><style>hidden</style><h1>Game</h1><p>R$&nbsp;449,90</p>'), "Game R$ 449,90");
});

test("rechecks full store pages and does not let search-snippet prices bypass verification", async (t) => {
  const config = { apiKey: "test", baseUrl: "https://openrouter.ai/api/v1", model: "test", provider: "openrouter" };
  const calls = [];
  t.mock.method(globalThis, "fetch", async (target, options) => {
    calls.push(target);
    if (target === url) return new Response("<h1>Grand Theft Auto VI</h1><p>Upcoming Xbox game. Add to wishlist. No preorder is open yet. No price is published. This is the current store page.</p>", { headers: { "Content-Type": "text/html" } });
    const body = JSON.parse(options.body);
    if (body.plugins) return Response.json(response([offer]));
    assert.match(body.messages[1].content, /No preorder is open yet/);
    return Response.json(response([{ ...offer, availability: "announced", price: null, currency: null }], []));
  });
  const result = await searchMarketplaces(input, config);
  assert.equal(calls.length, marketplaceSearchScopes.length + 2);
  assert.equal(result.offers[0].availability, "announced");
  assert.equal(result.offers[0].price, null);
});

test("does not follow store redirects to untrusted hosts or silently use stale snippets", async (t) => {
  const config = { apiKey: "test", baseUrl: "https://openrouter.ai/api/v1", model: "test", provider: "openrouter" };
  const calls = [];
  t.mock.method(globalThis, "fetch", async (target) => {
    calls.push(target);
    if (target === url) return new Response(null, { status: 302, headers: { location: "https://127.0.0.1/private" } });
    return Response.json(response([offer]));
  });
  const result = await searchMarketplaces(input, config);
  assert.equal(result.partial, true);
  assert.equal(result.offers[0].availability, "unknown");
  assert.equal(result.offers[0].price, null);
  assert.ok(calls.every((target) => target === "https://openrouter.ai/api/v1/chat/completions" || target === url));
});

test("queries every store group and retains PlayStation independently of Xbox ranking", async (t) => {
  const config = { apiKey: "test", baseUrl: "https://openrouter.ai/api/v1", model: "test", provider: "openrouter" };
  const ps = { ...offer, store: "PlayStation Store", platform: "PS5", url: "https://store.playstation.com/pt-br/product/gta-vi" };
  const searched = [];
  t.mock.method(globalThis, "fetch", async (target, options) => {
    if (target === url || target === ps.url) return new Response("<h1>Grand Theft Auto VI</h1><p>Preorders available in Brazil for the Standard edition, a digital license on your own account. Full purchase price BRL 449.90.</p>", { headers: { "Content-Type": "text/html" } });
    const body = JSON.parse(options.body);
    if (body.plugins) {
      const domains = body.plugins[0].include_domains;
      searched.push(domains);
      const offers = domains.includes("store.playstation.com") ? [ps] : domains.includes("xbox.com") ? [offer] : [];
      return Response.json(response(offers, offers.length ? offers.map((item) => item.url) : [`https://${domains[0]}/`]));
    }
    assert.doesNotMatch(body.messages[0].content, /platformName/);
    const pages = JSON.parse(body.messages[1].content);
    return Response.json(response(pages.map((page) => page.url === ps.url ? ps : offer), []));
  });
  const result = await searchMarketplaces({ ...input, platformName: "Xbox Series X|S" }, config);
  assert.equal(searched.length, marketplaceSearchScopes.length);
  assert.deepEqual(result.offers.map((item) => item.platform), ["PS5", "Xbox Series X|S"]);
  assert.equal(result.partial, false);
});

test("rechecks the Brazilian PlayStation page when search only cites the American product", async (t) => {
  const config = { apiKey: "test", baseUrl: "https://openrouter.ai/api/v1", model: "test", provider: "openrouter" };
  const americanUrl = "https://store.playstation.com/en-us/concept/10000730";
  const brazilianUrl = "https://store.playstation.com/pt-br/concept/10000730";
  const ps = { ...offer, store: "PlayStation Store", platform: "PS5", url: americanUrl, price: null, currency: null };
  const pagesRead = [];
  t.mock.method(globalThis, "fetch", async (target, options) => {
    if (!target.endsWith("/chat/completions")) {
      pagesRead.push(target);
      assert.equal(target, brazilianUrl);
      return new Response("<h1>Grand Theft Auto VI</h1><p>PS5: pré-venda da edição Standard no Brasil por R$ 449,90. Licença digital para sua própria conta PlayStation.</p>", { headers: { "Content-Type": "text/html" } });
    }
    const body = JSON.parse(options.body);
    if (body.plugins) {
      const domains = body.plugins[0].include_domains;
      return Response.json(domains.includes("store.playstation.com") ? response([ps]) : response([], [`https://${domains[0]}/`]));
    }
    const pages = JSON.parse(body.messages[1].content);
    assert.equal(pages[0].url, brazilianUrl);
    return Response.json(response([{ ...ps, url: brazilianUrl, price: 449.9, currency: "BRL" }], []));
  });
  const result = await searchMarketplaces(input, config);
  assert.deepEqual(pagesRead, [brazilianUrl]);
  assert.equal(result.offers[0].url, brazilianUrl);
  assert.equal(result.offers[0].price, 449.9);
});

test("one failed store group and a blocked page cannot erase other platforms", async (t) => {
  const config = { apiKey: "test", baseUrl: "https://openrouter.ai/api/v1", model: "test", provider: "openrouter" };
  const ps = { ...offer, store: "PlayStation Store", platform: "PS5", url: "https://store.playstation.com/pt-br/product/gta-vi" };
  t.mock.method(globalThis, "fetch", async (target, options) => {
    if (target === ps.url) return new Response("Access denied", { status: 403 });
    if (target === url) return new Response("<h1>Grand Theft Auto VI</h1><p>Xbox preorders available in Brazil for the Standard edition, a digital license on your own account. Full purchase price BRL 449.90.</p>", { headers: { "Content-Type": "text/html" } });
    const body = JSON.parse(options.body);
    if (body.plugins) {
      const domains = body.plugins[0].include_domains;
      if (domains.includes("store.steampowered.com")) return new Response("Search unavailable", { status: 503 });
      const offers = domains.includes("store.playstation.com") ? [ps] : domains.includes("xbox.com") ? [offer] : [];
      return Response.json(response(offers, offers.length ? offers.map((item) => item.url) : [`https://${domains[0]}/`]));
    }
    return Response.json(response([offer], []));
  });
  const result = await searchMarketplaces(input, config);
  assert.equal(result.partial, true);
  const playstation = result.offers.find((item) => item.platform === "PS5");
  assert.equal(playstation.url, ps.url);
  assert.equal(playstation.price, null);
  assert.equal(playstation.availability, "unknown");
  assert.equal(result.offers.find((item) => item.platform === "Xbox Series X|S").price, 449.9);
});

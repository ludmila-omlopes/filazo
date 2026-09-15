import assert from "node:assert/strict";
import test from "node:test";
import {
  parseXboxCatalogProduct,
  parseSteamAppDetails,
  parseStorePageOffer,
} from "./marketplace-direct.ts";

const input = {
  title: "Hades",
  region: "BR",
  locale: "pt-BR",
} as const;

test("parses a Steam AppDetails price without an AI provider", () => {
  const offer = parseSteamAppDetails({
    "1145360": {
      success: true,
      data: {
        name: "Hades",
        is_free: false,
        price_overview: {
          currency: "BRL",
          final: 7399,
          final_formatted: "R$ 73,99",
        },
        release_date: { coming_soon: false },
      },
    },
  }, "1145360", input);

  assert.equal(offer?.store, "Steam");
  assert.equal(offer?.price, 73.99);
  assert.equal(offer?.currency, "BRL");
  assert.equal(offer?.purchaseType, "digital");
});

test("rejects a Steam result for a different title", () => {
  const offer = parseSteamAppDetails({
    "1145360": {
      success: true,
      data: { name: "Hades II", is_free: false },
    },
  }, "1145360", input);

  assert.equal(offer, null);
});

test("parses a PlayStation-style JSON-LD product price", () => {
  const page = `
    <meta property="og:title" content="Hades | Official PlayStation Store">
    <script type="application/ld+json">
      {"@type":"Product","name":"Hades","offers":{"price":73.99,"priceCurrency":"BRL","availability":"https://schema.org/InStock"}}
    </script>`;
  const offer = parseStorePageOffer(page, input);

  assert.equal(offer.title, "Hades");
  assert.deepEqual(offer.price, { amount: 73.99, currency: "BRL" });
  assert.equal(offer.availability, "available");
});

test("parses a localized visible price when metadata is unavailable", () => {
  const page = `
    <title>Hades - Xbox</title>
    <main><h1>Hades</h1><span>R$ 73,99</span></main>`;
  const offer = parseStorePageOffer(page, input);

  assert.equal(offer.title, "Hades");
  assert.deepEqual(offer.price, { amount: 73.99, currency: "BRL" });
});

test("parses an Xbox catalog price and Game Pass eligibility without an AI provider", () => {
  const result = parseXboxCatalogProduct({
    Products: [{
      LocalizedProperties: [{
        ProductTitle: "Hades",
        EligibilityProperties: {
          Affirmations: [{ Description: "with your Xbox Game Pass membership" }],
        },
      }],
      DisplaySkuAvailabilities: [{
        Availabilities: [
          {
            Markets: ["BR"],
            Actions: ["Purchase", "Browse"],
            OrderManagementData: { Price: { CurrencyCode: "BRL", ListPrice: 99.9 } },
          },
          {
            Markets: ["BR"],
            Actions: ["License"],
            AffirmationId: "GAME-PASS",
            OrderManagementData: { Price: { CurrencyCode: "BRL", ListPrice: 0 } },
          },
        ],
      }],
    }],
  }, "9P8DL6W0JBB8", input);

  assert.equal(result.offers[0]?.store, "Xbox");
  assert.equal(result.offers[0]?.price, 99.9);
  assert.equal(result.offers[0]?.currency, "BRL");
  assert.equal(result.subscriptions[0]?.service, "Xbox Game Pass");
});

import { ExternalProvider, type Prisma } from "@prisma/client";
import {
  localizeMarketplaceUrl,
  marketplaceInputSchema,
  marketplaceRegions,
  normalizeMarketplaceUrl,
  type MarketplaceInput,
  type MarketplaceOffer,
  type MarketplaceResult,
  type MarketplaceSubscription,
} from "./assistant/marketplace-search.ts";
import { prisma } from "./prisma.ts";
import { normalizeTitle, slugify } from "./utils.ts";

const PAGE_TIMEOUT_MS = 12_000;
const MAX_PAGE_BYTES = 2_000_000;
const MAX_CANDIDATES_PER_STORE = 3;

const playStationLocales = {
  BR: "pt-br",
  US: "en-us",
  PT: "pt-pt",
  CA: "en-ca",
  GB: "en-gb",
} as const;

const xboxLocales = {
  BR: "pt-BR",
  US: "en-US",
  PT: "pt-PT",
  CA: "en-CA",
  GB: "en-GB",
} as const;

type ProviderLink = {
  provider: ExternalProvider;
  providerGameId: string;
  storeUrl: string | null;
  rawData: Prisma.JsonValue | null;
};

type StorePage = {
  url: string;
  html: string;
  text: string;
};

type ParsedPrice = {
  amount: number;
  currency: string;
};

type ParsedStoreOffer = {
  title: string | null;
  price: ParsedPrice | null;
  availability: MarketplaceOffer["availability"];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function stripHtml(value: string) {
  return decodeHtml(value
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function readAttribute(attributes: string, name: string) {
  const match = attributes.match(new RegExp(`${escapeRegExp(name)}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? decodeHtml(match[1]).trim() : null;
}

function readMeta(html: string, names: string[]) {
  for (const match of html.matchAll(/<meta\b([^>]*?)>/gi)) {
    const attributes = match[1];
    const key = readAttribute(attributes, "property") ?? readAttribute(attributes, "name");
    const content = readAttribute(attributes, "content");
    if (key && content && names.some((name) => key.toLowerCase() === name.toLowerCase())) {
      return content;
    }
  }
  return null;
}

function extractJsonLd(html: string) {
  const values: unknown[] = [];
  for (const match of html.matchAll(/<script\b([^>]*type\s*=\s*["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi)) {
    try {
      values.push(JSON.parse(match[2].trim()));
    } catch {
      // Some storefronts inject invalid JSON-LD fragments. Other sources may
      // still contain a valid product price, so ignore only this fragment.
    }
  }
  return values;
}

function flattenJson(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenJson);
  if (!isRecord(value)) return [];
  return [value, ...(Array.isArray(value["@graph"]) ? value["@graph"].flatMap(flattenJson) : [])];
}

function parseMoney(value: unknown, currency: string) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[^\d,.-]/g, "").trim();
  if (!normalized) return null;
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  let decimalNormalized = normalized;
  if (lastComma > lastDot) {
    decimalNormalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma && (normalized.length - lastDot - 1) !== 3) {
    decimalNormalized = normalized.replace(/,/g, "");
  } else if (currency !== "USD" && lastComma >= 0) {
    decimalNormalized = normalized.replace(/\./g, "").replace(",", ".");
  }
  const parsed = Number(decimalNormalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeListedTitle(value: string | null) {
  if (!value) return null;
  return stripHtml(value)
    .replace(/\s*[|·-]\s*(?:official\s+)?(?:playstation\s+store|steam|xbox).*$/i, "")
    .trim() || null;
}

function titleMatches(candidate: string | null, requested: string) {
  if (!candidate) return false;
  const listed = normalizeTitle(candidate);
  const wanted = normalizeTitle(requested);
  if (listed === wanted) return true;
  if (!listed.startsWith(`${wanted} `)) return false;
  const suffix = listed.slice(wanted.length + 1);
  return /^(?:(?:standard|ultimate|deluxe|digital|premium|gold|complete|definitive|collector s|goty)\s*)+(?:edition)?$/.test(suffix);
}

function pageTitle(html: string) {
  return normalizeListedTitle(
    readMeta(html, ["og:title", "twitter:title"]) ??
      html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
      null,
  );
}

function getJsonLdOffer(record: Record<string, unknown>) {
  const offers = record.offers;
  const candidates = Array.isArray(offers) ? offers.filter(isRecord) : isRecord(offers) ? [offers] : [];
  return candidates.find((candidate) => candidate.price !== undefined) ?? null;
}

function parseJsonLdProduct(html: string, requestedCurrency: string): ParsedStoreOffer {
  for (const root of extractJsonLd(html)) {
    for (const record of flattenJson(root)) {
      const type = record["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (!types.some((item) => typeof item === "string" && /product|softwareapplication/i.test(item))) continue;
      const title = stringValue(record.name);
      const offer = getJsonLdOffer(record);
      if (!offer) continue;
      const currency = stringValue(offer.priceCurrency ?? record.priceCurrency)?.toUpperCase();
      const price = currency ? parseMoney(offer.price, currency) : null;
      return {
        title: normalizeListedTitle(title),
        price: price !== null && currency === requestedCurrency ? { amount: price, currency } : null,
        availability: readAvailability(offer.availability),
      };
    }
  }
  return { title: pageTitle(html), price: null, availability: "unknown" };
}

function parseMetaProduct(html: string, requestedCurrency: string): ParsedStoreOffer {
  const title = pageTitle(html);
  const rawPrice = readMeta(html, ["product:price:amount", "price"]) ??
    html.match(/\bitemprop\s*=\s*["']price["'][^>]*\bcontent\s*=\s*["']([^"']+)["']/i)?.[1] ?? null;
  const rawCurrency = readMeta(html, ["product:price:currency", "priceCurrency", "currency"]);
  const currency = rawCurrency?.toUpperCase() ?? requestedCurrency;
  const amount = parseMoney(rawPrice, currency) ?? parseVisiblePrice(stripHtml(html), requestedCurrency);
  return {
    title,
    price: amount !== null && currency === requestedCurrency ? { amount, currency } : null,
    availability: readAvailability(stripHtml(html)),
  };
}

function parseVisiblePrice(text: string, currency: string) {
  const symbols: Record<string, RegExp> = {
    BRL: /(?:R\$|BRL)\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i,
    USD: /(?:US\$|USD|\$)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/i,
    EUR: /(?:€|EUR)\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,
    CAD: /(?:CA\$|CAD)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/i,
    GBP: /(?:£|GBP)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/i,
  };
  const match = symbols[currency]?.exec(text);
  return match ? parseMoney(match[1], currency) : null;
}

function readAvailability(value: unknown): MarketplaceOffer["availability"] {
  const text = typeof value === "string" ? value.toLowerCase() : "";
  if (/pre.?order|pre.?venda/.test(text)) return "preorder";
  if (/outofstock|out.of.stock|unavailable|indispon[ií]vel/.test(text)) return "unavailable";
  if (/comingsoon|coming soon|em breve|announced|anunciado/.test(text)) return "announced";
  if (/instock|in stock|available|dispon[ií]vel/.test(text)) return "available";
  return "unknown";
}

export function parseStorePageOffer(html: string, input: MarketplaceInput): ParsedStoreOffer {
  const jsonLd = parseJsonLdProduct(html, marketplaceRegions[input.region].currency);
  if (jsonLd.price || (jsonLd.title && jsonLd.availability !== "unknown")) {
    return {
      ...jsonLd,
      availability: jsonLd.availability === "unknown" && jsonLd.price ? "available" : jsonLd.availability,
    };
  }
  return parseMetaProduct(html, marketplaceRegions[input.region].currency);
}

export function parseSteamAppDetails(payload: unknown, appId: string, input: MarketplaceInput): MarketplaceOffer | null {
  if (!isRecord(payload)) return null;
  const app = payload[appId];
  if (!isRecord(app) || app.success !== true || !isRecord(app.data)) return null;
  const data = app.data;
  const listedTitle = stringValue(data.name);
  if (!titleMatches(listedTitle, input.title)) return null;
  const url = `https://store.steampowered.com/app/${encodeURIComponent(appId)}/`;
  const priceOverview = isRecord(data.price_overview) ? data.price_overview : null;
  const isFree = data.is_free === true;
  const apiCurrency = stringValue(priceOverview?.currency)?.toUpperCase() ?? marketplaceRegions[input.region].currency;
  const finalCents = typeof priceOverview?.final === "number" ? priceOverview.final : null;
  const price = isFree ? 0 : finalCents !== null && Number.isFinite(finalCents) ? finalCents / 100 : null;
  const availability = data.release_date && isRecord(data.release_date) && data.release_date.coming_soon === true
    ? price === null ? "announced" : "preorder"
    : "available";
  const formatted = stringValue(priceOverview?.final_formatted);
  const evidence = isFree
    ? "A página oficial da Steam identifica o jogo como gratuito."
    : formatted
      ? `A página oficial da Steam informa ${formatted} nesta região.`
      : price !== null
        ? `A página oficial da Steam informa o preço nesta região.`
        : "A página oficial da Steam foi localizada, mas não expôs um preço confirmado.";
  return {
    store: "Steam",
    title: listedTitle!,
    edition: null,
    platform: "PC · Steam",
    url,
    availability,
    purchaseType: "digital",
    price,
    currency: price === null ? null : apiCurrency === marketplaceRegions[input.region].currency ? apiCurrency : null,
    evidence,
  };
}

function isAllowedStoreUrl(value: string) {
  const normalized = normalizeMarketplaceUrl(value);
  if (!normalized) return false;
  const host = new URL(normalized).hostname.toLowerCase();
  return host === "store.steampowered.com" ||
    host === "store.playstation.com" || host.endsWith(".playstation.com") ||
    host === "xbox.com" || host.endsWith(".xbox.com") ||
    host === "microsoft.com" || host.endsWith(".microsoft.com");
}

async function readRemoteText(url: string, signal: AbortSignal): Promise<StorePage | null> {
  let current = normalizeMarketplaceUrl(url);
  if (!current || !isAllowedStoreUrl(current)) return null;
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      cache: "no-store",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Filazo-StoreLookup/1.0 (+https://filazo.app)",
      },
      signal: AbortSignal.any([signal, AbortSignal.timeout(PAGE_TIMEOUT_MS)]),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) return null;
      current = normalizeMarketplaceUrl(new URL(location, current).href);
      if (!current || !isAllowedStoreUrl(current)) return null;
      continue;
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      return null;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_PAGE_BYTES) return null;
        html += decoder.decode(chunk.value, { stream: true });
      }
      html += decoder.decode();
    } finally {
      await reader.cancel();
    }
    const text = stripHtml(html);
    return text.length >= 40 ? { url: current, html, text } : null;
  }
  return null;
}

async function readRemoteJson(url: string, signal: AbortSignal) {
  let normalized = normalizeMarketplaceUrl(url);
  if (!normalized || !isAllowedStoreUrl(normalized)) return null;
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const response = await fetch(normalized, {
      redirect: "manual",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "Filazo-StoreLookup/1.0 (+https://filazo.app)",
      },
      signal: AbortSignal.any([signal, AbortSignal.timeout(PAGE_TIMEOUT_MS)]),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) return null;
      normalized = normalizeMarketplaceUrl(new URL(location, normalized).href);
      if (!normalized || !isAllowedStoreUrl(normalized)) return null;
      continue;
    }
    if (!response.ok) return null;
    try {
      return await response.json() as unknown;
    } catch {
      return null;
    }
  }
  return null;
}

function providerRawRecord(value: Prisma.JsonValue | null) {
  return isRecord(value) ? value : {};
}

function readSteamAppIds(links: ProviderLink[]) {
  return unique(links
    .filter((link) => link.provider === ExternalProvider.STEAM)
    .flatMap((link) => {
      const fromId = /^\d+$/.test(link.providerGameId) ? link.providerGameId : null;
      const fromUrl = link.storeUrl?.match(/\/app\/(\d+)/i)?.[1] ?? null;
      return [fromId, fromUrl].filter((value): value is string => Boolean(value));
    }));
}

function readPlayStationUrls(links: ProviderLink[], region: MarketplaceInput["region"]) {
  const locale = playStationLocales[region];
  return unique(links
    .filter((link) => link.provider === ExternalProvider.PLAYSTATION)
    .flatMap((link) => {
      const raw = providerRawRecord(link.rawData);
      const productId = stringValue(raw.productId) ?? link.providerGameId.match(/^productId:(.+)$/i)?.[1] ?? null;
      const conceptId = stringValue(raw.conceptId) ?? link.providerGameId.match(/^conceptId:(.+)$/i)?.[1] ?? null;
      const supplied = link.storeUrl && isAllowedStoreUrl(link.storeUrl)
        ? [localizeMarketplaceUrl(link.storeUrl, region) ?? link.storeUrl]
        : [];
      return [...supplied,
        productId ? `https://store.playstation.com/${locale}/product/${encodeURIComponent(productId)}` : null,
        conceptId ? `https://store.playstation.com/${locale}/concept/${encodeURIComponent(conceptId)}` : null,
      ].filter((value): value is string => Boolean(value));
    }));
}

function isXboxProductId(value: string | null): value is string {
  return Boolean(value && /^[a-z\d]{8,}$/i.test(value));
}

function readXboxProductIds(links: ProviderLink[]) {
  return unique(links
    .filter((link) => link.provider === ExternalProvider.XBOX)
    .flatMap((link) => {
      const raw = providerRawRecord(link.rawData);
      const nestedTitle = isRecord(raw.title) ? raw.title : {};
      const fromId = link.providerGameId.match(/^productId:(.+)$/i)?.[1] ?? null;
      const fromUrl = link.storeUrl?.match(/(?:\/games\/store\/[^/]+|\/detail)\/([a-z\d]{8,})(?:[/?#]|$)/i)?.[1] ?? null;
      return [
        stringValue(raw.productId),
        stringValue(nestedTitle.productId),
        fromId,
        fromUrl,
      ].filter(isXboxProductId);
    }));
}

function extractStoreLinks(html: string, baseUrl: string, hostPattern: RegExp, pathPattern: RegExp) {
  const links: Array<{ url: string; label: string }> = [];
  for (const match of html.matchAll(/<a\b([^>]*?)href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const rawUrl = decodeHtml(match[2]);
    let url: URL;
    try {
      url = new URL(rawUrl, baseUrl);
    } catch {
      continue;
    }
    if (!hostPattern.test(url.hostname) || !pathPattern.test(url.pathname)) continue;
    links.push({ url: url.href, label: stripHtml(match[3]) });
  }
  return links;
}

async function searchSteamByTitle(input: MarketplaceInput, signal: AbortSignal) {
  const url = new URL("https://store.steampowered.com/api/storesearch/");
  url.searchParams.set("term", input.title);
  url.searchParams.set("cc", input.region.toLowerCase());
  url.searchParams.set("l", input.locale === "pt-BR" ? "brazilian" : "english");
  const payload = await readRemoteJson(url.href, signal);
  if (!isRecord(payload) || !Array.isArray(payload.items)) return [];
  return payload.items
    .filter(isRecord)
    .filter((item) => titleMatches(stringValue(item.name), input.title))
    .map((item) => stringValue(item.id) ?? stringValue(item.appid))
    .filter((value): value is string => Boolean(value))
    .slice(0, MAX_CANDIDATES_PER_STORE);
}

async function fetchSteamOffers(input: MarketplaceInput, links: ProviderLink[], signal: AbortSignal) {
  const appIds = readSteamAppIds(links);
  const resolvedIds = appIds.length ? appIds : await searchSteamByTitle(input, signal);
  const results = await Promise.allSettled(resolvedIds.slice(0, MAX_CANDIDATES_PER_STORE).map(async (appId) => {
    const url = new URL("https://store.steampowered.com/api/appdetails");
    url.searchParams.set("appids", appId);
    url.searchParams.set("cc", input.region.toLowerCase());
    url.searchParams.set("l", input.locale === "pt-BR" ? "brazilian" : "english");
    return parseSteamAppDetails(await readRemoteJson(url.href, signal), appId, input);
  }));
  return results.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
}

type XboxDirectResult = {
  offers: MarketplaceOffer[];
  subscriptions: MarketplaceSubscription[];
};

function xboxProductUrl(title: string, productId: string, region: MarketplaceInput["region"]) {
  return `https://www.xbox.com/${xboxLocales[region]}/games/store/${slugify(title)}/${encodeURIComponent(productId)}`;
}

function xboxProductTitle(product: Record<string, unknown>) {
  const localized = Array.isArray(product.LocalizedProperties)
    ? product.LocalizedProperties.find(isRecord)
    : null;
  return stringValue(product.ProductTitle) ?? (localized ? stringValue(localized.ProductTitle) : null);
}

function xboxProductEligibility(product: Record<string, unknown>) {
  const localized = Array.isArray(product.LocalizedProperties)
    ? product.LocalizedProperties.filter(isRecord)
    : [];
  const eligibility = localized
    .map((item) => item.EligibilityProperties)
    .find(isRecord);
  const affirmations = eligibility && Array.isArray(eligibility.Affirmations)
    ? eligibility.Affirmations.filter(isRecord)
    : [];
  return affirmations
    .map((affirmation) => ({
      description: stringValue(affirmation.Description) ?? "",
      tier: /premium/i.test(stringValue(affirmation.Description) ?? "") ? "Premium" : null,
    }))
    .filter((item) => /game\s*pass/i.test(item.description));
}

function xboxAvailabilityRecords(product: Record<string, unknown>) {
  const skuGroups = Array.isArray(product.DisplaySkuAvailabilities)
    ? product.DisplaySkuAvailabilities.filter(isRecord)
    : [];
  return skuGroups.flatMap((group) => Array.isArray(group.Availabilities)
    ? group.Availabilities.filter(isRecord)
    : []);
}

function xboxPriceCandidates(product: Record<string, unknown>, input: MarketplaceInput) {
  const currency = marketplaceRegions[input.region].currency;
  return xboxAvailabilityRecords(product)
    .filter((availability) => {
      const markets = Array.isArray(availability.Markets) ? availability.Markets : [];
      return markets.length === 0 || markets.some((market) => market === input.region);
    })
    .map((availability) => {
      const orderData = isRecord(availability.OrderManagementData) ? availability.OrderManagementData : null;
      const price = orderData && isRecord(orderData.Price) ? orderData.Price : null;
      const actions = Array.isArray(availability.Actions) ? availability.Actions : [];
      const amount = price && typeof price.ListPrice === "number" && Number.isFinite(price.ListPrice)
        ? price.ListPrice
        : null;
      return {
        amount,
        currency: price ? stringValue(price.CurrencyCode)?.toUpperCase() : null,
        isSubscriptionEntitlement: Boolean(stringValue(availability.AffirmationId)),
        isPurchasable: actions.some((action) => action === "Purchase"),
      };
    })
    .filter((candidate) => candidate.amount !== null && candidate.currency === currency)
    .sort((left, right) => {
      if (left.isSubscriptionEntitlement !== right.isSubscriptionEntitlement) {
        return left.isSubscriptionEntitlement ? 1 : -1;
      }
      if (left.isPurchasable !== right.isPurchasable) return left.isPurchasable ? -1 : 1;
      return left.amount! - right.amount!;
    });
}

export function parseXboxCatalogProduct(
  payload: unknown,
  productId: string,
  input: MarketplaceInput,
): XboxDirectResult {
  if (!isRecord(payload) || !Array.isArray(payload.Products)) return { offers: [], subscriptions: [] };
  const product = payload.Products
    .filter(isRecord)
    .find((candidate) => titleMatches(xboxProductTitle(candidate), input.title));
  if (!product) return { offers: [], subscriptions: [] };

  const title = xboxProductTitle(product) ?? input.title;
  const url = xboxProductUrl(title, productId, input.region);
  const prices = xboxPriceCandidates(product, input);
  const priceCandidate = prices.find((candidate) => !candidate.isSubscriptionEntitlement) ?? null;
  const price = priceCandidate && priceCandidate.amount !== null && priceCandidate.currency
    ? { amount: priceCandidate.amount, currency: priceCandidate.currency }
    : null;
  const memberships = xboxProductEligibility(product);
  const tiers = unique(memberships.map((membership) => membership.tier).filter((tier): tier is string => Boolean(tier)));
  const subscriptions = memberships.length ? [{
    service: "Xbox Game Pass",
    title,
    tier: tiers.join(" / ") || null,
    url,
    evidence: input.locale === "pt-BR"
      ? `O catálogo da Microsoft indica disponibilidade com ${tiers.length ? `o Xbox Game Pass (${tiers.join(" / ")})` : "o Xbox Game Pass"}.`
      : `Microsoft's catalog indicates availability with ${tiers.length ? `Xbox Game Pass (${tiers.join(" / ")})` : "Xbox Game Pass"}.`,
  } satisfies MarketplaceSubscription] : [];

  return {
    offers: price ? [{
      store: "Xbox",
      title,
      edition: null,
      platform: "Xbox",
      url,
      availability: "available",
      purchaseType: "digital",
      price: price.amount,
      currency: price.currency,
      evidence: input.locale === "pt-BR"
        ? `O catálogo oficial da Microsoft informa ${price.currency} ${price.amount.toFixed(2)} nesta região.`
        : `Microsoft's official catalog reports ${price.currency} ${price.amount.toFixed(2)} in this region.`,
    } satisfies MarketplaceOffer] : [],
    subscriptions,
  };
}

async function searchXboxByTitle(input: MarketplaceInput, signal: AbortSignal) {
  const url = new URL("https://displaycatalog.mp.microsoft.com/v7.0/productFamilies/autosuggest");
  url.searchParams.set("languages", input.locale === "pt-BR" ? "pt-BR" : xboxLocales[input.region]);
  url.searchParams.set("market", input.region);
  url.searchParams.set("platformdependencyname", "windows.xbox");
  url.searchParams.set("productFamilyNames", "Games,Apps");
  url.searchParams.set("query", input.title);
  url.searchParams.set("topProducts", String(MAX_CANDIDATES_PER_STORE));
  const payload = await readRemoteJson(url.href, signal);
  if (!isRecord(payload) || !Array.isArray(payload.Results)) return [];
  return payload.Results
    .filter(isRecord)
    .flatMap((result) => Array.isArray(result.Products) ? result.Products.filter(isRecord) : [])
    .filter((product) => titleMatches(stringValue(product.Title), input.title))
    .map((product) => stringValue(product.ProductId))
    .filter(isXboxProductId)
    .slice(0, MAX_CANDIDATES_PER_STORE);
}

async function fetchXboxOffers(input: MarketplaceInput, links: ProviderLink[], signal: AbortSignal): Promise<XboxDirectResult> {
  const linkedIds = readXboxProductIds(links);
  const productIds = linkedIds.length ? linkedIds : await searchXboxByTitle(input, signal);
  const results = await Promise.allSettled(productIds.slice(0, MAX_CANDIDATES_PER_STORE).map(async (productId) => {
    const url = new URL("https://displaycatalog.mp.microsoft.com/v7.0/products");
    url.searchParams.set("market", input.region);
    url.searchParams.set("languages", input.locale === "pt-BR" ? "pt-BR" : xboxLocales[input.region]);
    url.searchParams.set("bigIds", productId);
    url.searchParams.set("fieldsTemplate", "Details");
    url.searchParams.set("actionFilter", "Browse");
    return parseXboxCatalogProduct(await readRemoteJson(url.href, signal), productId, input);
  }));
  return results.reduce<XboxDirectResult>((total, result) => {
    if (result.status === "fulfilled") {
      total.offers.push(...result.value.offers);
      total.subscriptions.push(...result.value.subscriptions);
    }
    return total;
  }, { offers: [], subscriptions: [] });
}

async function fetchPageOffers(
  input: MarketplaceInput,
  urls: string[],
  store: "PlayStation Store" | "Xbox",
  signal: AbortSignal,
) {
  const results = await Promise.allSettled(urls.slice(0, MAX_CANDIDATES_PER_STORE).map(async (url) => {
    const page = await readRemoteText(url, signal);
    if (!page) return null;
    const parsed = parseStorePageOffer(page.html, input);
    if (parsed.title && !titleMatches(parsed.title, input.title)) return null;
    const priceText = parsed.price ? `${parsed.price.currency} ${parsed.price.amount.toFixed(2)}` : null;
    return {
      store,
      title: parsed.title ?? input.title,
      edition: null,
      platform: store === "Xbox" ? "Xbox" : "PlayStation",
      url: page.url,
      availability: parsed.availability === "unknown" && parsed.price ? "available" : parsed.availability,
      purchaseType: "digital",
      price: parsed.price?.amount ?? null,
      currency: parsed.price?.currency ?? null,
      evidence: priceText
        ? `A página oficial da ${store} informa ${priceText} nesta região.`
        : `A página oficial da ${store} foi localizada, mas não expôs um preço confirmado.`,
    } satisfies MarketplaceOffer;
  }));
  return results.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
}

async function resolveStoreSearchUrls(input: MarketplaceInput, store: "PlayStation" | "Xbox", signal: AbortSignal) {
  const url = store === "PlayStation"
    ? `https://store.playstation.com/${playStationLocales[input.region]}/search/${encodeURIComponent(input.title)}`
    : `https://www.xbox.com/${xboxLocales[input.region]}/games/store?query=${encodeURIComponent(input.title)}`;
  const page = await readRemoteText(url, signal);
  if (!page) return [];
  const links = store === "PlayStation"
    ? extractStoreLinks(page.html, `https://store.playstation.com/${playStationLocales[input.region]}/`, /(?:^|\.)store\.playstation\.com$/i, /\/(?:product|concept)\//i)
    : extractStoreLinks(page.html, `https://www.xbox.com/${xboxLocales[input.region]}/`, /(?:^|\.)xbox\.com$/i, /\/games\/store\//i);
  return links
    .filter((link) => titleMatches(link.label, input.title))
    .map((link) => link.url)
    .slice(0, MAX_CANDIDATES_PER_STORE);
}

function catalogHasTitle(page: StorePage, title: string) {
  const normalizedPage = normalizeTitle(page.text);
  const normalizedTitle = normalizeTitle(title);
  if (!normalizedTitle) return false;
  return new RegExp(`(?:^|\\s)${escapeRegExp(normalizedTitle)}(?:$|\\s)`, "i").test(normalizedPage);
}

function subscriptionEvidence(service: string, input: MarketplaceInput) {
  return input.locale === "pt-BR"
    ? `O título aparece no catálogo oficial de ${service} para esta região.`
    : `The title appears in the official ${service} catalog for this region.`;
}

async function fetchSubscriptions(input: MarketplaceInput, signal: AbortSignal) {
  const catalogs = [
    {
      service: "PlayStation Plus",
      tier: null,
      url: `https://www.playstation.com/${playStationLocales[input.region]}/ps-plus/games/`,
    },
    {
      service: "Xbox Game Pass",
      tier: null,
      url: `https://www.xbox.com/${xboxLocales[input.region]}/xbox-game-pass/games`,
    },
  ] as const;
  const results = await Promise.allSettled(catalogs.map(async (catalog) => {
    const page = await readRemoteText(catalog.url, signal);
    if (!page || !catalogHasTitle(page, input.title)) return null;
    const catalogLinks = catalog.service === "PlayStation Plus"
      ? extractStoreLinks(page.html, page.url, /(?:^|\.)playstation\.com$/i, /\/(?:product|concept)\//i)
      : extractStoreLinks(page.html, page.url, /(?:^|\.)xbox\.com$/i, /\/games\/store\//i);
    const matchedLink = catalogLinks.find((link) => titleMatches(link.label, input.title));
    return {
      service: catalog.service,
      title: input.title,
      tier: catalog.tier,
      url: matchedLink?.url ?? page.url,
      evidence: subscriptionEvidence(catalog.service, input),
    } satisfies MarketplaceSubscription;
  }));
  return results.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
}

export async function searchDirectMarketplaces({
  gameId,
  input,
  signal,
}: {
  gameId: string;
  input: MarketplaceInput;
  signal?: AbortSignal;
}): Promise<MarketplaceResult> {
  const parsedInput = marketplaceInputSchema.parse(input);
  const links = await prisma.gameProviderLink.findMany({
    where: { gameId, provider: { in: [ExternalProvider.STEAM, ExternalProvider.PLAYSTATION, ExternalProvider.XBOX] } },
    select: { provider: true, providerGameId: true, storeUrl: true, rawData: true },
  });
  const searchSignal = AbortSignal.any([AbortSignal.timeout(45_000), ...(signal ? [signal] : [])]);
  const playStationUrls = readPlayStationUrls(links, parsedInput.region);
  const tasks: [
    Promise<MarketplaceOffer[]>,
    Promise<MarketplaceOffer[]>,
    Promise<XboxDirectResult>,
    Promise<MarketplaceSubscription[]>,
  ] = [
    fetchSteamOffers(parsedInput, links, searchSignal),
    (async () => fetchPageOffers(parsedInput, playStationUrls.length ? playStationUrls : await resolveStoreSearchUrls(parsedInput, "PlayStation", searchSignal), "PlayStation Store", searchSignal))(),
    fetchXboxOffers(parsedInput, links, searchSignal),
    fetchSubscriptions(parsedInput, searchSignal),
  ];
  const results = await Promise.allSettled(tasks);
  searchSignal.throwIfAborted();
  const offers = [
    ...(results[0].status === "fulfilled" ? results[0].value : []),
    ...(results[1].status === "fulfilled" ? results[1].value : []),
    ...(results[2].status === "fulfilled" ? results[2].value.offers : []),
  ];
  const subscriptions = [
    ...(results[2].status === "fulfilled" ? results[2].value.subscriptions : []),
    ...(results[3].status === "fulfilled" ? results[3].value : []),
  ];
  const seenOffers = new Set<string>();
  const seenSubscriptions = new Set<string>();
  return {
    region: parsedInput.region,
    checkedAt: new Date().toISOString(),
    partial: results.filter((result) => result.status === "fulfilled").length < tasks.length || results.some((result) => result.status === "rejected"),
    offers: offers.filter((offer) => {
      if (seenOffers.has(offer.url)) return false;
      seenOffers.add(offer.url);
      return true;
    }),
    subscriptions: subscriptions.filter((subscription) => {
      if (seenSubscriptions.has(subscription.url)) return false;
      seenSubscriptions.add(subscription.url);
      return true;
    }),
  };
}

import { normalizeMarketplaceUrl, storePageText } from "./assistant/marketplace-search.ts";

// Fetch only known official storefront/publisher hosts. Arbitrary URLs returned
// by the model must not reach internal services or be labeled primary sources.
export const releaseSourceDomains = [
  "store.steampowered.com", "store.epicgames.com", "gog.com", "playstation.com",
  "xbox.com", "nintendo.com", "apps.apple.com", "play.google.com", "ubisoft.com",
  "square-enix.com", "bandainamcoent.com", "bandainamcoent.eu", "capcom.com",
  "sega.com", "ea.com", "rockstargames.com", "bethesda.net", "2k.com",
  "remedygames.com", "505games.com", "devolverdigital.com", "team17.com",
  "annapurnainteractive.com", "focus-entmt.com", "koeitecmoamerica.com",
  "konami.com", "atlus.com", "paradoxinteractive.com", "thqnordic.com",
];

export function isPrimaryReleaseUrl(value: string) {
  const normalized = normalizeMarketplaceUrl(value);
  if (!normalized) return false;
  const host = new URL(normalized).hostname;
  return releaseSourceDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function normalize(text: string) {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function hasReleaseEvidence(page: string, release: { title: string; platform: string; releaseDate: Date | null; evidence: string }) {
  const content = normalize(page);
  const evidence = normalize(release.evidence);
  if (!evidence.includes(normalize(release.title)) || evidence.length < 20 || !content.includes(evidence)) return false;
  if (/\b(placeholder|tentative|rumor|rumour|unconfirmed|estimated|provisorio|estimado)\b/.test(evidence)) return false;
  const aliases: Record<string, string[]> = {
    PC: ["pc", "steam", "windows"], PS5: ["ps5", "playstation 5"], PS4: ["ps4", "playstation 4"],
    "Xbox Series X|S": ["xbox series"], "Xbox One": ["xbox one"],
    "Nintendo Switch": ["nintendo switch"], "Nintendo Switch 2": ["switch 2"], iOS: ["ios", "iphone"], Android: ["android"],
  };
  if (!(aliases[release.platform] ?? []).some((alias) => new RegExp(`\\b${alias}\\b`).test(evidence))) return false;
  if (release.platform === "Nintendo Switch" && /switch 2/.test(evidence) && !/switch (?:and|e) switch 2/.test(evidence)) return false;
  if (!/\b(release|releases|released|launch|launches|launching|available|coming|arrives|arriving|delayed|out|lancamento|lanca|disponivel|chega|adiado|adiamento)\b/.test(evidence)) return false;
  if (!release.releaseDate) return true;
  const date = release.releaseDate;
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const english = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][month];
  const portuguese = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][month];
  const candidates = [date.toISOString().slice(0, 10), `${english} ${day} ${year}`, `${day} ${english} ${year}`, `${day} de ${portuguese} de ${year}`];
  // Require the year as well. Placeholder dates, page publication dates and
  // another game's release are not sufficient without a matching excerpt.
  return candidates.some((value) => evidence.includes(normalize(value)));
}

export async function readReleaseSource(value: string): Promise<string | null> {
  let url = value;
  const signal = AbortSignal.timeout(12_000);
  try {
    for (let redirect = 0; redirect < 4; redirect++) {
      if (!isPrimaryReleaseUrl(url)) return null;
      const response = await fetch(url, { redirect: "manual", cache: "no-store", signal, headers: { Accept: "text/html", "User-Agent": "Filazo-ReleaseDates/1.0" } });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location) return null;
        url = new URL(location, url).href;
        continue;
      }
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html") || !response.body) {
        await response.body?.cancel();
        return null;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let bytes = 0;
      let html = "";
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 2_000_000) return null;
          html += decoder.decode(chunk.value, { stream: true });
        }
      } finally { await reader.cancel(); }
      return storePageText(html + decoder.decode());
    }
  } catch { /* A blocked or unreadable page is not usable evidence. */ }
  return null;
}

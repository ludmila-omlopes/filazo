import { normalizePlatformNames } from "./platform-names.ts";

// Store aliases on PC do not imply a second console/platform purchase.
export function libraryPlatformKey(platformName?: string | null, provider?: string | null) {
  const name = normalizePlatformNames(platformName).sort().join(", ").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, " ").trim();
  if (/^(pc|pc microsoft windows|windows|steam|gog|epic games|epic games store)$/.test(name)) return "pc";
  if (/^(ps4|playstation 4|playstation ps4)$/.test(name)) return "ps4";
  if (/^(ps5|playstation 5|playstation ps5)$/.test(name)) return "ps5";
  if (/^(ps3|playstation 3|playstation ps3)$/.test(name)) return "ps3";
  if (/^(switch|nintendo switch)$/.test(name)) return "switch";
  if (/^(switch 2|nintendo switch 2)$/.test(name)) return "switch2";
  if (/^xbox series/.test(name)) return "xbox-series";
  if (name === "xbox one") return "xbox-one";
  if (name) return name;
  if (provider === "STEAM" || provider === "GOG") return "pc";
  if (provider === "PLAYSTATION") return "playstation";
  if (provider === "XBOX") return "xbox";
  return "unknown";
}

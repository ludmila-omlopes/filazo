import { normalizeTitle } from "./utils";

export function metadataPlatformMatches(platformName: string, platforms: string[]) {
  const aliases: Record<string, string> = {
    steam: "pc microsoft windows", gog: "pc microsoft windows", pc: "pc microsoft windows",
    ps3: "playstation 3", ps4: "playstation 4", ps5: "playstation 5",
    "xbox series xs": "xbox series xs", "xbox series x s": "xbox series xs",
  };
  const normalize = (value: string) => aliases[normalizeTitle(value)] ?? normalizeTitle(value);
  const supplied = platformName.split(",").map(normalize);
  // Sync adapters may group platform families, e.g. "PS4, PS5".
  return platforms.some(platform => supplied.includes(normalize(platform)));
}

// A shared name is not proof of identity. Never break homonym/remake ties by API order.
export function selectUnambiguousTitleMatch<T extends { id: number; name: string; platforms?: Array<{ name: string }> }>(
  title: string, candidates: T[], platformName?: string | null,
): T | null {
  const matches = [...new Map(candidates
    .filter(game => normalizeTitle(game.name) === normalizeTitle(title))
    .map(game => [game.id, game])).values()];
  const compatible = platformName
    ? matches.filter(game => metadataPlatformMatches(platformName, game.platforms?.map(p => p.name) ?? []))
    : matches;
  return compatible.length === 1 ? compatible[0] : null;
}

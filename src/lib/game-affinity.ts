import { z } from "zod";

const named = z.object({ id: z.number().int().positive(), name: z.string() });
export const affinityProfileSchema = z.object({
  igdbId: z.number().int().positive(),
  keywords: z.array(named), genres: z.array(named), themes: z.array(named),
  perspectives: z.array(named), modes: z.array(named),
  developers: z.array(named), collections: z.array(named),
  similarIds: z.array(z.number().int().positive()),
});
export type AffinityProfile = z.infer<typeof affinityProfileSchema>;

const mechanics = {
  soulslike: ["soulslike", "soulsborne"],
  metroidvania: ["metroidvania"],
  roguelike: ["roguelike", "roguelite"],
  deckbuilding: ["deckbuilding", "deckbuilder"],
  farming: ["farmingsimulator", "farmingsimulation"],
  survival: ["survivalcrafting", "craftingsurvival", "survivalgame"],
  turnbased: ["turnbasedcombat", "turnbasedstrategy", "turnbasedtactics"],
  rhythm: ["rhythmgame", "rhythm"],
  racing: ["racing", "racinggame"],
  stealth: ["stealth", "stealthgame"],
  citybuilding: ["citybuilding", "citybuilder"],
  bullethell: ["bullethell", "danmaku"],
  platforming: ["platformer", "platforming", "precisionplatformer"],
} as const;
export type AffinityMechanic = keyof typeof mechanics;
const normalized = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const genericKeywords = new Set([
  "singleplayer", "multiplayer", "action", "adventure", "rpg", "fantasy",
  "videogame", "thirdperson", "firstperson", "3d", "2d", "openworld",
  "controller", "steam", "achievements", "violence", "blood", "maleprotagonist",
]);

export function profileMechanics(profile: AffinityProfile): AffinityMechanic[] {
  const words = new Set([...profile.keywords, ...profile.genres].map(item => normalized(item.name)));
  return (Object.keys(mechanics) as AffinityMechanic[])
    .filter(key => mechanics[key].some(word => words.has(word)));
}

const reasonSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("mechanic"), mechanic: z.enum(Object.keys(mechanics) as [AffinityMechanic, ...AffinityMechanic[]]) }),
  z.object({ kind: z.literal("similar") }),
  z.object({ kind: z.literal("features") }),
]);
export const discoverySnapshotSchema = z.object({
  version: z.literal(1), refreshAfter: z.string().datetime(),
  profile: affinityProfileSchema,
  recommendations: z.array(z.object({ gameId: z.string().min(1), score: z.number(), reason: reasonSchema })).max(6),
});
export type AffinityReason = z.infer<typeof reasonSchema>;

function overlap(left: { id: number }[], right: { id: number }[]) {
  const ids = new Set(left.map(item => item.id));
  return new Set(right.filter(item => ids.has(item.id)).map(item => item.id)).size;
}

/** Broad genres/popularity cannot qualify a game on their own. */
export function scoreGameAffinity(source: AffinityProfile, candidate: AffinityProfile) {
  if (source.igdbId === candidate.igdbId) return null;
  const sourceMechanics = profileMechanics(source);
  const candidateMechanics = profileMechanics(candidate);
  const sharedMechanics = sourceMechanics.filter(key => candidateMechanics.includes(key));
  // A known gameplay family takes priority over a provider's broad related list.
  if (sourceMechanics.length && !sharedMechanics.length) return null;
  if (sourceMechanics.includes("soulslike") && candidateMechanics.includes("turnbased") && !sourceMechanics.includes("turnbased")) return null;
  const specific = (items: AffinityProfile["keywords"]) => items.filter(item =>
    !genericKeywords.has(normalized(item.name)) && !/steam|achievements|controller support|game awards|wasd|auto-saving/i.test(item.name));
  const keywords = overlap(specific(source.keywords), specific(candidate.keywords));
  const similar = source.similarIds.includes(candidate.igdbId) || candidate.similarIds.includes(source.igdbId);
  const genres = overlap(source.genres, candidate.genres);
  const themes = overlap(source.themes, candidate.themes);
  const perspectives = overlap(source.perspectives, candidate.perspectives);
  if (!sharedMechanics.length && !(similar && genres && (keywords || themes || perspectives)) && !(keywords >= 3 && perspectives)) return null;
  const perspectivePenalty = source.perspectives.length && candidate.perspectives.length && !perspectives ? 20 : 0;
  const score = sharedMechanics.length * 60 + (similar ? 15 : 0)
    + Math.min(keywords * 8, 24) + Math.min(themes * 4, 8)
    + Math.min(genres * 2, 6) + Math.min(perspectives * 4, 8)
    + Math.min(overlap(source.modes, candidate.modes) * 3, 6)
    + Math.min(overlap(source.developers, candidate.developers) * 6, 6)
    + Math.min(overlap(source.collections, candidate.collections) * 8, 8) - perspectivePenalty;
  if (score < 40) return null;
  const reason: AffinityReason = sharedMechanics.length
    ? { kind: "mechanic", mechanic: sharedMechanics[0] }
    : { kind: similar ? "similar" : "features" };
  return { score, reason };
}

export function isDiscoveryGameType(type: string | undefined) {
  return !type || ["main game", "standalone expansion", "remake", "remaster", "expanded game", "port", "episode"].includes(type.toLowerCase());
}

export function readDiscoverySnapshot(rawData: unknown) {
  const record = rawData && typeof rawData === "object" && !Array.isArray(rawData) ? rawData as Record<string, unknown> : {};
  const parsed = discoverySnapshotSchema.safeParse(record.gameDiscovery);
  return parsed.success ? parsed.data : null;
}

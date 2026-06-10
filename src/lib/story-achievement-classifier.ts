// Pure classification logic for finding a game's "credits roll" achievement.
// Kept free of Prisma/provider imports so node:test can load it directly.

export type StoryAchievementCandidate = {
  id: string;
  name: string;
  description?: string | null;
};

const STORY_PATTERNS: RegExp[] = [
  /\b(complete|completed|finish|finished|beat|clear|cleared)\b.{0,24}\b(main )?(story|game|campaign|main quest|adventure|journey)\b/,
  /\b(story|game|campaign)\b.{0,16}\b(complete|completed|finished|cleared|beaten)\b/,
  /\b(see|saw|watch|watched|roll|rolled)\b.{0,12}\bcredits\b/,
  /\bcredits roll\b/,
  /\breach(ed)? (the )?end(ing)?\b/,
  /\b(see|saw|witness(ed)?|unlock(ed)?|got|achieve[d]?)\b.{0,12}\b(an |any |the )?ending\b/,
  /\bfinal (boss|chapter|mission|battle)\b.{0,24}\b(defeat(ed)?|complete[d]?|beat(en)?|clear(ed)?|finish(ed)?)\b/,
  /\b(defeat(ed)?|beat(en)?)\b.{0,24}\bfinal (boss|battle)\b/,
  /^the end$/,
];

const DIFFICULTY_PATTERN =
  /\b(hard|hardest|very hard|nightmare|hell|inferno|expert|master|lethal|extreme|hardcore|new game\s?\+|ng\+|all difficult|without dying|no deaths?|100%)\b/;

function candidateText(candidate: StoryAchievementCandidate) {
  return `${candidate.name} ${candidate.description ?? ""}`.toLowerCase();
}

/**
 * Picks the achievement most likely awarded when the main story ends.
 * Pattern order encodes priority; among matches of the same pattern,
 * difficulty-agnostic achievements win over difficulty-specific ones.
 */
export function classifyStoryAchievementHeuristically(
  candidates: StoryAchievementCandidate[],
): StoryAchievementCandidate | null {
  for (const pattern of STORY_PATTERNS) {
    const matches = candidates.filter((candidate) =>
      pattern.test(candidateText(candidate)),
    );
    if (matches.length === 0) {
      continue;
    }

    return (
      matches.find((match) => !DIFFICULTY_PATTERN.test(candidateText(match))) ??
      matches[0]
    );
  }

  return null;
}

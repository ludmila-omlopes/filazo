export type TonightPickSource<TPick> = {
  storedRecommendations: TPick[];
  generatedPicks: TPick[];
  shelfPicks: TPick[];
};

/**
 * Tonight always deals a card: start with curated recommendations, then fill
 * the deck from fresh rule signals and finally any recommendable shelf entry.
 */
export function selectTonightBasePicks<TPick extends { entryId: string }>(
  sources: TonightPickSource<TPick>,
  maxPicks = Number.POSITIVE_INFINITY,
): TPick[] {
  const selected: TPick[] = [];
  const seenEntryIds = new Set<string>();

  for (const pick of [
    ...sources.storedRecommendations,
    ...sources.generatedPicks,
    ...sources.shelfPicks,
  ]) {
    if (seenEntryIds.has(pick.entryId)) {
      continue;
    }

    seenEntryIds.add(pick.entryId);
    selected.push(pick);
    if (selected.length === maxPicks) {
      break;
    }
  }

  return selected;
}

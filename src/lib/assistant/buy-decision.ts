import { UserGameStatus } from "@prisma/client";

export type BuyDecisionEntry = {
  status: UserGameStatus;
  playtimeMinutes?: number | null;
  game: {
    name: string;
    genres?: unknown;
  };
};

export type BuyDecisionInput = {
  title: string;
  platformName?: string;
  priceText?: string;
  reasonUserWantsIt?: string;
  genres?: string[];
};

export type BuyDecision = {
  verdict: "BUY_NOW" | "WAIT_FOR_SALE" | "WISHLIST_ONLY" | "SKIP_FOR_NOW";
  confidence: number;
  reasons: string[];
  risks: string[];
  suggestedTrigger?: string;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function parsePrice(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/[^0-9.,]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function overlaps(left: string[], right: string[]) {
  const rightSet = new Set(right.map(normalize));
  return left.filter((item) => rightSet.has(normalize(item))).length;
}

function readStringList(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (typeof value === "string") {
    try {
      return readStringList(JSON.parse(value));
    } catch {
      return [value];
    }
  }
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (item && typeof item === "object" && "name" in item) {
        return String((item as { name?: unknown }).name ?? "");
      }
      return "";
    })
    .filter(Boolean);
}

function entryGenres(entry: BuyDecisionEntry) {
  return readStringList(entry.game.genres);
}

export function decideBuy(
  input: BuyDecisionInput,
  libraryEntries: BuyDecisionEntry[],
): BuyDecision {
  const title = normalize(input.title);
  const price = parsePrice(input.priceText);
  const candidateGenres = input.genres ?? [];
  const ownedMatch = libraryEntries.find(
    (entry) =>
      normalize(entry.game.name) === title &&
      entry.status !== UserGameStatus.WISHLIST,
  );

  if (ownedMatch) {
    return {
      verdict: "SKIP_FOR_NOW",
      confidence: 96,
      reasons: [`${ownedMatch.game.name} is already in your library.`],
      risks: ["You already have a copy waiting for you."],
      suggestedTrigger: "Open or release the copy you already own first.",
    };
  }

  const untouchedCount = libraryEntries.filter(
    (entry) =>
      entry.status !== UserGameStatus.WISHLIST &&
      (entry.playtimeMinutes ?? 0) === 0,
  ).length;
  const playedEntries = libraryEntries.filter(
    (entry) => (entry.playtimeMinutes ?? 0) >= 120,
  );
  const untouchedSimilar = libraryEntries.filter(
    (entry) =>
      entry.status !== UserGameStatus.WISHLIST &&
      (entry.playtimeMinutes ?? 0) === 0 &&
      overlaps(candidateGenres, entryGenres(entry)) > 0,
  );
  const playedGenreMatches = playedEntries.filter(
    (entry) => overlaps(candidateGenres, entryGenres(entry)) > 0,
  );
  const hasCuriosityOnlyReason =
    input.reasonUserWantsIt &&
    /\b(hype|sale|cheap|discount|curious|fomo)\b/i.test(input.reasonUserWantsIt);
  const goodFit = candidateGenres.length > 0 && playedGenreMatches.length >= 2;
  const backlogConflict = untouchedSimilar.length >= 2;

  if (goodFit && !backlogConflict && (price === null || price <= 30)) {
    return {
      verdict: "BUY_NOW",
      confidence: 72,
      reasons: [
        "It matches genres you actually play.",
        price === null
          ? "No price was provided."
          : `The entered price is ${input.priceText}.`,
      ],
      risks:
        untouchedCount > 20 ? ["Your shelf already has plenty of choices."] : [],
      suggestedTrigger: "Buy when you know the first session you want with it.",
    };
  }

  if (goodFit && backlogConflict) {
    return {
      verdict: "WAIT_FOR_SALE",
      confidence: 78,
      reasons: [
        "It fits your played genres, and similar owned games are already waiting.",
      ],
      risks: [
        `${untouchedSimilar.length} similar owned games have no recorded playtime.`,
      ],
      suggestedTrigger: "Buy after you try one similar game for 45 minutes.",
    };
  }

  if (hasCuriosityOnlyReason || backlogConflict || untouchedCount > 30) {
    return {
      verdict: "WISHLIST_ONLY",
      confidence: 70,
      reasons: [
        hasCuriosityOnlyReason
          ? "Your stated reason sounds curiosity or sale driven."
          : "Your current shelf may already cover this mood.",
      ],
      risks: backlogConflict
        ? [`${untouchedSimilar.length} similar owned games are already waiting.`]
        : ["This may be more curiosity than a game for now."],
      suggestedTrigger: "Keep it as a curiosity and revisit when the mood returns.",
    };
  }

  return {
    verdict: "SKIP_FOR_NOW",
    confidence: 64,
    reasons: [
      "There is not enough evidence that this fits what you currently play.",
    ],
    risks: ["There is not much evidence that this matches your current taste."],
    suggestedTrigger: "Skip unless you can name the exact first session you want to play.",
  };
}

import { UserGameStatus } from "@prisma/client";
import { translate, type Locale } from "../i18n.ts";

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
  locale?: Locale;
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
  const locale = input.locale ?? "en";
  const t = (
    key: Parameters<typeof translate>[1],
    values?: Record<string, string | number>,
  ) => translate(locale, key, values);
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
      reasons: [
        t("assistant.buyDecision.reason.alreadyOwned", {
          game: ownedMatch.game.name,
        }),
      ],
      risks: [t("assistant.buyDecision.risk.alreadyOwned")],
      suggestedTrigger: t("assistant.buyDecision.trigger.alreadyOwned"),
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
        t("assistant.buyDecision.reason.genreMatch"),
        price === null
          ? t("assistant.buyDecision.reason.noPrice")
          : t("assistant.buyDecision.reason.enteredPrice", {
              price: input.priceText ?? "",
            }),
      ],
      risks:
        untouchedCount > 20
          ? [t("assistant.buyDecision.risk.fullShelf")]
          : [],
      suggestedTrigger: t("assistant.buyDecision.trigger.buyNow"),
    };
  }

  if (goodFit && backlogConflict) {
    return {
      verdict: "WAIT_FOR_SALE",
      confidence: 78,
      reasons: [
        t("assistant.buyDecision.reason.genreMatchWithBacklog"),
      ],
      risks: [
        t("assistant.buyDecision.risk.similarUntouched", {
          count: untouchedSimilar.length,
        }),
      ],
      suggestedTrigger: t("assistant.buyDecision.trigger.waitForSale"),
    };
  }

  if (hasCuriosityOnlyReason || backlogConflict || untouchedCount > 30) {
    return {
      verdict: "WISHLIST_ONLY",
      confidence: 70,
      reasons: [
        hasCuriosityOnlyReason
          ? t("assistant.buyDecision.reason.curiosity")
          : t("assistant.buyDecision.reason.shelfCoversMood"),
      ],
      risks: backlogConflict
        ? [
            t("assistant.buyDecision.risk.similarWaiting", {
              count: untouchedSimilar.length,
            }),
          ]
        : [t("assistant.buyDecision.risk.curiosity")],
      suggestedTrigger: t("assistant.buyDecision.trigger.wishlistOnly"),
    };
  }

  return {
    verdict: "SKIP_FOR_NOW",
    confidence: 64,
    reasons: [
      t("assistant.buyDecision.reason.notEnoughEvidence"),
    ],
    risks: [t("assistant.buyDecision.risk.notEnoughEvidence")],
    suggestedTrigger: t("assistant.buyDecision.trigger.skip"),
  };
}

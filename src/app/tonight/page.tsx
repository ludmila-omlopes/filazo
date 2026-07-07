import Link from "next/link";
import { cookies } from "next/headers";
import { ControllerIllustration } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { createTranslator } from "@/lib/i18n";
import {
  getAssistantProfileData,
  type PlayNextProfileRecommendation,
} from "@/lib/assistant/queries";
import { isEntryRecommendable } from "@/lib/assistant/eligibility";
import { getRequestLocale } from "@/lib/request-locale";
import { estimateRemainingTime } from "@/lib/time-estimates";
import { orderPicksForMood } from "@/lib/tonight-moods";
import { selectTonightBasePicks } from "@/lib/tonight-picks";
import { FILAZO_THEME_COOKIE, parseFilazoThemeMode } from "@/lib/theme";
import { getSessionUserId } from "@/lib/session";
import { TonightRoom, type TonightMood, type TonightPick } from "./_components/tonight-room";

type TonightSearchParams = Promise<{
  mood?: string;
  skip?: string;
  message?: string;
}>;

const moodLabels = [
  ["short", "something short"],
  ["cozy", "something cozy"],
  ["gripping", "something gripping"],
  ["old-save", "back to an old save"],
  ["surprise", "surprise me"],
] as const;

function buildMoodHref(value: string) {
  return `/tonight?mood=${value}`;
}

function toTonightPick(
  recommendation: PlayNextProfileRecommendation,
): TonightPick {
  return {
    entryId: recommendation.entryId,
    reason: recommendation.reason,
    source: recommendation.source,
    entry: {
      completionPercent: recommendation.entry.completionPercent,
      finishedAt: recommendation.entry.finishedAt,
      platformName: recommendation.entry.platformName,
      playtimeMinutes: recommendation.entry.playtimeMinutes,
      remainingMinutes:
        estimateRemainingTime(recommendation.entry)?.remainingMinutes ?? null,
      status: recommendation.entry.status,
      game: recommendation.entry.game,
    },
  };
}

function toRuleTonightPick(
  entry: Awaited<ReturnType<typeof getAssistantProfileData>>["entries"][number],
  reason: string,
): TonightPick {
  return {
    entryId: entry.id,
    reason,
    source: "rules",
    entry: {
      completionPercent: entry.completionPercent,
      finishedAt: entry.finishedAt,
      platformName: entry.platformName,
      playtimeMinutes: entry.playtimeMinutes,
      remainingMinutes: estimateRemainingTime(entry)?.remainingMinutes ?? null,
      status: entry.status,
      game: entry.game,
    },
  };
}

export default async function TonightPage({
  searchParams,
}: PageProps<"/tonight"> & { searchParams: TonightSearchParams }) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const userId = await getSessionUserId();
  const cookieStore = await cookies();
  const mode = parseFilazoThemeMode(cookieStore.get(FILAZO_THEME_COOKIE)?.value);
  const query = await searchParams;
  const mood = moodLabels.some(([value]) => value === query.mood)
    ? query.mood!
    : "surprise";
  const offset = Math.max(0, Number(query.skip ?? 0) || 0);
  const moods: TonightMood[] = moodLabels.map(([value]) => ({
    value,
    label:
      value === "short"
        ? t("tonight.mood.short")
        : value === "cozy"
          ? t("tonight.mood.cozy")
          : value === "gripping"
            ? t("tonight.mood.gripping")
            : value === "old-save"
              ? t("tonight.mood.oldSave")
              : t("tonight.mood.surprise"),
    href: buildMoodHref(value),
  }));

  if (!userId) {
    return (
      <main
        id="main-content"
        className="mx-auto grid min-h-[56vh] w-full max-w-[760px] place-items-center"
      >
        <section className="panel text-center">
          <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-inner border border-edge bg-canvas text-ink-soft">
            <ControllerIllustration className="h-14 w-14" />
          </div>
          <p className="section-label justify-center">{t("common.tonight")}</p>
          <h1 className="text-page-title leading-tight">
            {t("tonight.signInTitle")}
          </h1>
          <p className="mx-auto mt-3 max-w-[44ch] leading-relaxed text-ink-soft">
            {t("tonight.signInBody")}
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild>
              <Link href="/profile">{t("tonight.goToCatalog")}</Link>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  const assistant = await getAssistantProfileData(userId);
  const shuffleSeed = `${userId}:${new Date().toISOString().slice(0, 10)}`;
  const entryById = new Map(assistant.entries.map((entry) => [entry.id, entry]));
  const fallbackFromGenerated = assistant.generatedInsights
    .map((insight) => {
      const entry = entryById.get(insight.entryId);

      return entry
        ? toRuleTonightPick(
            entry,
            [insight.reasons[0]?.evidence, insight.suggestedAction]
              .filter(Boolean)
              .join(" "),
          )
        : null;
    })
    .filter((pick): pick is TonightPick => Boolean(pick));
  const fallbackFromShelf = assistant.entries
    .filter(
      (entry) => isEntryRecommendable(entry) && entry.status !== "WISHLIST",
    )
    .map((entry) =>
      toRuleTonightPick(
        entry,
        t("tonight.fallbackReason"),
      ),
    );
  const basePicks = selectTonightBasePicks({
    storedRecommendations: assistant.playNextRecommendations.map(toTonightPick),
    generatedPicks: fallbackFromGenerated,
    shelfPicks: fallbackFromShelf,
  });
  const orderedPicks = orderPicksForMood(
    basePicks,
    mood,
    `${shuffleSeed}:${mood}`,
  );
  const playingPick =
    orderedPicks.find((pick) => pick.entry.status === "PLAYING") ?? null;
  const pick =
    orderedPicks.length > 0
      ? orderedPicks[offset % orderedPicks.length]
      : null;

  return (
    <main id="main-content" className="mx-auto w-full max-w-[1100px] pb-12">
      <TonightRoom
        alternatives={[]}
        currentMood={mood}
        deck={orderedPicks}
        isNight={mode === "night"}
        key={`${mood}:${offset}:${pick?.entryId ?? "empty"}`}
        locale={locale}
        message={query.message}
        moods={moods}
        offset={offset}
        pick={pick}
        playingPick={playingPick}
      />
    </main>
  );
}

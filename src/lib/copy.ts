import { translate, type Locale } from "@/lib/i18n";

export function getStatusDisplayLabel(
  status: string | null | undefined,
  locale: Locale = "en",
) {
  if (!status) {
    return translate(locale, "status.BACKLOG");
  }

  return (
    ({
      BACKLOG: translate(locale, "status.BACKLOG"),
      OWNED: translate(locale, "status.OWNED"),
      WISHLIST: translate(locale, "status.WISHLIST"),
      PLAYING: translate(locale, "status.PLAYING"),
      PAUSED: translate(locale, "status.PAUSED"),
      COMPLETED: translate(locale, "status.COMPLETED"),
      FINISHED: translate(locale, "status.FINISHED"),
      DROPPED: translate(locale, "status.DROPPED"),
    })[status] ??
    status
      .toLowerCase()
      .replaceAll("_", " ")
  );
}

export function getAssistantSignalDisplayLabel(
  signal: string,
  locale: Locale = "en",
) {
  return (
    ({
      UNTOUCHED: translate(locale, "signal.UNTOUCHED"),
      SAMPLED_DROPPED: translate(locale, "signal.SAMPLED_DROPPED"),
      STALE_PLAYING: translate(locale, "signal.STALE_PLAYING"),
      FINISHABLE_SOON: translate(locale, "signal.FINISHABLE_SOON"),
      LIKELY_FINISHED: translate(locale, "signal.LIKELY_FINISHED"),
      WISHLIST_RISK: translate(locale, "signal.WISHLIST_RISK"),
      BUY_RISK: translate(locale, "signal.BUY_RISK"),
      RETURN_CANDIDATE: translate(locale, "signal.RETURN_CANDIDATE"),
      RELEASE_CANDIDATE: translate(locale, "signal.RELEASE_CANDIDATE"),
    })[signal] ??
    signal
      .toLowerCase()
      .replaceAll("_", " ")
  );
}

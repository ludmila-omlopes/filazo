export const statusDisplayLabels: Record<string, string> = {
  BACKLOG: "on the shelf",
  OWNED: "owned",
  WISHLIST: "still curious",
  PLAYING: "playing now",
  PAUSED: "paused",
  COMPLETED: "loved enough",
  FINISHED: "credits rolled",
  DROPPED: "released",
};

export function getStatusDisplayLabel(status: string | null | undefined) {
  if (!status) {
    return statusDisplayLabels.BACKLOG;
  }

  return (
    statusDisplayLabels[status] ??
    status
      .toLowerCase()
      .replaceAll("_", " ")
  );
}

export const assistantSignalDisplayLabels: Record<string, string> = {
  UNTOUCHED: "ready when you are",
  SAMPLED_DROPPED: "sampled once",
  STALE_PLAYING: "paused mid-journey",
  FINISHABLE_SOON: "a short return",
  LIKELY_FINISHED: "credits may have rolled",
  WISHLIST_RISK: "still curious",
  BUY_RISK: "pause before buying",
  RETURN_CANDIDATE: "worth a gentle return",
  RELEASE_CANDIDATE: "ready to release",
};

export function getAssistantSignalDisplayLabel(signal: string) {
  return (
    assistantSignalDisplayLabels[signal] ??
    signal
      .toLowerCase()
      .replaceAll("_", " ")
  );
}

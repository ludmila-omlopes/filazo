import { mergeXboxTitles, type XboxTitleHistoryItem, type XboxTitleHubItem } from "./xbox-library.ts";

type Authorization = { xuid: string; authorizationHeader: string };
type HistoryPage<T> = {
  titles: T[];
  pagingInfo?: { continuationToken?: string | null };
};

async function readHistory<T extends { titleId?: number | string }>(
  url: URL,
  headers: Record<string, string>,
  signal?: AbortSignal,
  requirePagingInfo = false,
): Promise<T[]> {
  const titles = new Map<string, T>();
  const seenTokens = new Set<string>();
  // A timeout cancels the entire read, not just the most recent page.
  const readSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
    : AbortSignal.timeout(30_000);

  while (true) {
    readSignal.throwIfAborted();
    const response = await fetch(url, { headers, signal: readSignal, cache: "no-store" });
    if (!response.ok) {
      const error = new Error(`Could not fetch Xbox title history (${response.status}).`) as Error & { retryAfter?: string };
      const retryAfter = response.headers.get("retry-after");
      if (retryAfter) error.retryAfter = retryAfter;
      throw error;
    }
    const page = await response.json() as HistoryPage<T>;
    if (!page || !Array.isArray(page.titles)) throw new Error("Xbox returned an invalid title history page.");
    if ((requirePagingInfo || page.pagingInfo != null) &&
        (!page.pagingInfo || !Object.hasOwn(page.pagingInfo, "continuationToken"))) {
      throw new Error("Xbox title history is missing pagination information.");
    }
    for (const title of page.titles) {
      if (title?.titleId != null && !titles.has(String(title.titleId))) titles.set(String(title.titleId), title);
    }

    // Page length is not an end marker: Xbox can return short/empty pages with a cursor.
    const token = page.pagingInfo?.continuationToken;
    if (token == null || token === "") return [...titles.values()];
    if (typeof token !== "string" || seenTokens.has(token)) throw new Error("Xbox title history pagination did not advance.");
    seenTokens.add(token);
    url.searchParams.set("continuationToken", token);
  }
}

export async function fetchXboxTitleHistories(authorization: Authorization, options: { signal?: AbortSignal } = {}) {
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  const user = `users/xuid(${encodeURIComponent(authorization.xuid)})`;
  const achievements = new URL(`https://achievements.xboxlive.com/${user}/history/titles`);
  // This is a page size, never a total-library limit.
  achievements.searchParams.set("maxItems", "100");
  const fields = "achievement,image,scid,detail,alternateTitleId,productId";
  const titleHub = new URL(`https://titlehub.xboxlive.com/${user}/titles/titlehistory/decoration/${fields}`);
  // TitleHub's history response is unpaged in the current contract. Omitting maxItems
  // requests the history instead of limiting it to the first 200 recent titles.
  // readHistory also follows pagingInfo if the service supplies it in the future.
  const headers = { Authorization: authorization.authorizationHeader, "x-xbl-contract-version": "2" };
  try {
    const [achievementTitles, titleHubTitles] = await Promise.all([
      readHistory<XboxTitleHistoryItem>(achievements, headers, signal, true),
      readHistory<XboxTitleHubItem>(titleHub, { ...headers,
        "Accept-Language": "en-US", "x-xbl-client-name": "XboxApp",
        "x-xbl-client-type": "UWA", "x-xbl-client-version": "39.39.22001.0",
      }, signal),
    ]);
    signal.throwIfAborted();
    return mergeXboxTitles(achievementTitles, titleHubTitles);
  } finally {
    // Do not leave the other source running after a failure or cancellation.
    controller.abort();
  }
}

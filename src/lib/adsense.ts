import { hasProAccess, type PlanAccount } from "./account-plans.ts";

export type AdPlacement = "library" | "game";
export type AdSenseConfig = { publisherId: string; slotId: string; testMode: boolean };

type AdEnvironment = Record<string, string | undefined>;

export function getAdSensePublisherId(env: AdEnvironment = process.env) {
  const id = env.ADSENSE_PUBLISHER_ID?.trim();
  return id && /^ca-pub-\d{16}$/.test(id) ? id : null;
}

export function getAdsTxt(env: AdEnvironment = process.env) {
  const id = getAdSensePublisherId(env);
  return id ? `google.com, ${id.slice(3)}, DIRECT, f08c47fec0942fa0\n` : null;
}

export function getAdSenseConfig(placement: AdPlacement, env: AdEnvironment = process.env): AdSenseConfig | null {
  if (env.ADSENSE_ENABLED !== "true") return null;
  const publisherId = getAdSensePublisherId(env);
  const slotId = env[placement === "library" ? "ADSENSE_LIBRARY_SLOT_ID" : "ADSENSE_GAME_SLOT_ID"]?.trim();
  if (!publisherId || !slotId || !/^\d+$/.test(slotId)) return null;

  return {
    publisherId,
    slotId,
    // Development and preview deployments must never generate live impressions.
    testMode: env.NODE_ENV !== "production" ||
      (Boolean(env.VERCEL_ENV) && env.VERCEL_ENV !== "production") || env.ADSENSE_TEST_MODE === "true",
  };
}

/** An unresolved signed-in account must never be treated as a Free visitor. */
export async function getViewerAdSenseConfig(
  config: AdSenseConfig | null,
  userId: string | null,
  loadAccount: (userId: string) => Promise<PlanAccount | null>,
  now?: Date,
  livemode?: boolean,
) {
  if (!config || !userId) return config;
  try {
    const account = await loadAccount(userId);
    // Missing subscription data is also an unknown entitlement, not Free.
    if (!account?.billingSubscriptions || hasProAccess(account, now, livemode)) return null;
    return config;
  } catch {
    return null;
  }
}

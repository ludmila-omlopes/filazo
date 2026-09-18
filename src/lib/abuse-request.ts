import { headers } from "next/headers";
import { consumeAbuseLimits } from "./abuse-limits";
import { abuseMessage, getClientNetwork, type AbusePolicy } from "./abuse-policy";
import { getRequestLocale } from "./request-locale";

export async function checkActionAbuse(policies: readonly AbusePolicy[], identity?: string) {
  const result = await consumeAbuseLimits(policies, identity ?? getClientNetwork(await headers()));
  if (result.allowed) return null;
  return abuseMessage(await getRequestLocale(), result.status === 503);
}

export async function checkApiAbuse(policies: readonly AbusePolicy[], identity: string) {
  const result = await consumeAbuseLimits(policies, identity);
  if (result.allowed) return null;
  return Response.json({
    error: abuseMessage(await getRequestLocale(), result.status === 503),
    code: result.status === 429 ? "RATE_LIMITED" : "LIMIT_UNAVAILABLE",
  }, { status: result.status, headers: {
    "Retry-After": String(result.retryAfter), "Cache-Control": "no-store",
  } });
}

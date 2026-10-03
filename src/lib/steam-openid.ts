const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const OPENID_NS = "http://specs.openid.net/auth/2.0";
const STEAM_CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
// OpenID 2.0 requires the signature to cover these fields (spec section 10.1).
const REQUIRED_SIGNED_FIELDS = [
  "op_endpoint",
  "claimed_id",
  "identity",
  "return_to",
  "response_nonce",
  "assoc_handle",
];
// Matches the state cookie lifetime, with a small allowance for clock skew.
const NONCE_MAX_AGE_MS = 10 * 60 * 1000;
const NONCE_MAX_FUTURE_SKEW_MS = 2 * 60 * 1000;

export function getSteamReturnUrl(origin: string, state?: string) {
  const returnTo = new URL(`${origin}/api/auth/steam/callback`);
  if (state) {
    returnTo.searchParams.set("state", state);
  }

  return returnTo;
}

export function createSteamAuthUrl(origin: string, state?: string) {
  const returnTo = getSteamReturnUrl(origin, state);

  const url = new URL(STEAM_OPENID_ENDPOINT);
  url.searchParams.set("openid.ns", OPENID_NS);
  url.searchParams.set("openid.mode", "checkid_setup");
  url.searchParams.set("openid.return_to", returnTo.toString());
  url.searchParams.set("openid.realm", origin);
  url.searchParams.set(
    "openid.identity",
    "http://specs.openid.net/auth/2.0/identifier_select",
  );
  url.searchParams.set(
    "openid.claimed_id",
    "http://specs.openid.net/auth/2.0/identifier_select",
  );
  return url.toString();
}

function rejectSteamAssertion(): never {
  throw new Error("Steam sign-in could not be verified.");
}

function isFreshNonce(nonce: string | null, now: Date) {
  const timestamp = nonce?.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/)?.[0];
  const issuedAt = timestamp ? Date.parse(timestamp) : Number.NaN;
  return (
    Number.isFinite(issuedAt) &&
    issuedAt >= now.getTime() - NONCE_MAX_AGE_MS &&
    issuedAt <= now.getTime() + NONCE_MAX_FUTURE_SKEW_MS
  );
}

/**
 * Steam signs any positive assertion, including ones it issued to other
 * sites. Before trusting the signature, require that the assertion was
 * issued for this callback and for the sign-in this browser started.
 */
export async function verifySteamOpenIdCallback(
  searchParams: URLSearchParams,
  {
    origin,
    state,
    now = new Date(),
    fetchImpl = fetch,
  }: { origin: string; state: string; now?: Date; fetchImpl?: typeof fetch },
) {
  if (
    searchParams.get("openid.ns") !== OPENID_NS ||
    searchParams.get("openid.mode") !== "id_res" ||
    searchParams.get("openid.op_endpoint") !== STEAM_OPENID_ENDPOINT
  ) {
    rejectSteamAssertion();
  }

  let returnTo: URL;
  try {
    returnTo = new URL(searchParams.get("openid.return_to") ?? "");
  } catch {
    rejectSteamAssertion();
  }
  if (returnTo.href !== getSteamReturnUrl(origin, state).href) {
    rejectSteamAssertion();
  }

  const claimedId = searchParams.get("openid.claimed_id") ?? "";
  const steamId = claimedId.match(STEAM_CLAIMED_ID)?.[1];
  if (!steamId || searchParams.get("openid.identity") !== claimedId) {
    rejectSteamAssertion();
  }

  const signedFields = new Set(
    (searchParams.get("openid.signed") ?? "").split(","),
  );
  if (
    !REQUIRED_SIGNED_FIELDS.every((field) => signedFields.has(field)) ||
    !isFreshNonce(searchParams.get("openid.response_nonce"), now)
  ) {
    rejectSteamAssertion();
  }

  const params = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key.startsWith("openid.")) {
      params.set(key, value);
    }
  });
  params.set("openid.mode", "check_authentication");

  const response = await fetchImpl(STEAM_OPENID_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  // Key-value form: one "key:value" pair per line (spec section 4.1.1).
  const fields = new Map(
    (await response.text()).split("\n").map((line) => {
      const separator = line.indexOf(":");
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
  );
  if (!response.ok || fields.get("is_valid") !== "true") {
    rejectSteamAssertion();
  }

  return steamId;
}

const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";

export function createSteamAuthUrl(origin: string, state?: string) {
  const returnTo = new URL(`${origin}/api/auth/steam/callback`);
  if (state) {
    returnTo.searchParams.set("state", state);
  }

  const url = new URL(STEAM_OPENID_ENDPOINT);
  url.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");
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

export async function verifySteamOpenIdCallback(
  searchParams: URLSearchParams,
) {
  const params = new URLSearchParams();
  searchParams.forEach((value, key) => {
    params.set(key, value);
  });
  params.set("openid.mode", "check_authentication");

  const response = await fetch(STEAM_OPENID_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  const text = await response.text();
  if (!text.includes("is_valid:true")) {
    throw new Error("Steam OpenID verification did not complete.");
  }

  const claimedId = searchParams.get("openid.claimed_id");
  const steamId =
    claimedId?.match(/\/id\/(\d+)$/)?.[1] ??
    claimedId?.match(/\/openid\/id\/(\d+)$/)?.[1];

  if (!steamId) {
    throw new Error("Steam OpenID callback did not include a valid Steam ID.");
  }

  return steamId;
}

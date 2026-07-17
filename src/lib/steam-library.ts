export type SteamOwnedGame = {
  appid: number;
  name?: string;
  playtime_forever?: number;
  img_icon_url?: string;
  img_logo_url?: string;
  rtime_last_played?: number;
};

function parseSteamLastPlayedAt(value: number | undefined) {
  if (!value || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value * 1000);
}

export function mapSteamOwnedGames(games: SteamOwnedGame[]) {
  return games
    .filter((game) => game.name)
    .map((game) => ({
      providerGameId: String(game.appid),
      title: game.name ?? `Steam App ${game.appid}`,
      platformName: "Steam",
      playtimeMinutes: game.playtime_forever ?? 0,
      lastPlayedAt: parseSteamLastPlayedAt(game.rtime_last_played),
      storeUrl: `https://store.steampowered.com/app/${game.appid}`,
      rawData: {
        appid: game.appid,
        iconUrl: game.img_icon_url ?? null,
        logoUrl: game.img_logo_url ?? null,
        rtimeLastPlayed: game.rtime_last_played ?? null,
      },
    }));
}

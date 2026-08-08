export function getBetaDiscordInviteUrl() {
  const configuredUrl = process.env.BETA_DISCORD_INVITE_URL?.trim();
  if (!configuredUrl) {
    return null;
  }

  try {
    const url = new URL(configuredUrl);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

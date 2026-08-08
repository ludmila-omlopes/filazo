import assert from "node:assert/strict";
import test from "node:test";
import { getBetaDiscordInviteUrl } from "./beta-community.ts";

test("beta Discord invite accepts public web URLs", () => {
  const previous = process.env.BETA_DISCORD_INVITE_URL;
  process.env.BETA_DISCORD_INVITE_URL = "https://discord.gg/filazo";

  try {
    assert.equal(
      getBetaDiscordInviteUrl(),
      "https://discord.gg/filazo",
    );
  } finally {
    if (previous === undefined) {
      delete process.env.BETA_DISCORD_INVITE_URL;
    } else {
      process.env.BETA_DISCORD_INVITE_URL = previous;
    }
  }
});

test("beta Discord invite rejects unsafe protocols", () => {
  const previous = process.env.BETA_DISCORD_INVITE_URL;
  process.env.BETA_DISCORD_INVITE_URL = "javascript:alert(1)";

  try {
    assert.equal(getBetaDiscordInviteUrl(), null);
  } finally {
    if (previous === undefined) {
      delete process.env.BETA_DISCORD_INVITE_URL;
    } else {
      process.env.BETA_DISCORD_INVITE_URL = previous;
    }
  }
});

"use server";

import { Resend } from "resend";

function getBaseUrl() {
  return (process.env.APP_URL || "http://localhost:3001").replace(/\/+$/, "");
}

function getDiscordInviteUrl() {
  return process.env.BETA_DISCORD_INVITE_URL?.trim() || null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getApprovalEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.BETA_APPROVAL_FROM_EMAIL?.trim();
  const replyTo = process.env.BETA_APPROVAL_REPLY_TO?.trim();

  if (!apiKey || !from) {
    return null;
  }

  return {
    apiKey,
    from,
    replyTo: replyTo || undefined,
  };
}

function buildApprovalEmail({
  recipientName,
}: {
  recipientName: string;
}) {
  const profileUrl = `${getBaseUrl()}/profile`;
  const discordInviteUrl = getDiscordInviteUrl();

  const greeting = recipientName.trim() || "there";
  const safeGreeting = escapeHtml(greeting);
  const safeProfileUrl = escapeHtml(profileUrl);
  const safeDiscordInviteUrl = discordInviteUrl
    ? escapeHtml(discordInviteUrl)
    : null;

  const text = [
    `Hi ${greeting},`,
    "",
    "Your filazo beta access has been approved.",
    `You can sign in and use the platform here: ${profileUrl}`,
    "",
    discordInviteUrl
      ? `Please join the beta Discord here: ${discordInviteUrl}`
      : "Please join the beta Discord server.",
    "Once you are in, send a message in #beta-testers so we know you arrived.",
    "",
    "See you inside,",
    "filazo",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <p>Hi ${safeGreeting},</p>
      <p>Your <strong>filazo</strong> beta access has been approved.</p>
      <p>
        You can sign in and use the platform here:
        <a href="${safeProfileUrl}">${safeProfileUrl}</a>
      </p>
      <p>
        ${
          safeDiscordInviteUrl
            ? `Please join the beta Discord here: <a href="${safeDiscordInviteUrl}">${safeDiscordInviteUrl}</a>.`
            : "Please join the beta Discord server."
        }
        Once you are in, send a message in <strong>#beta-testers</strong> so we know you arrived.
      </p>
      <p>See you inside,<br />filazo</p>
    </div>
  `;

  return {
    subject: "Your filazo beta access was approved",
    text,
    html,
  };
}

export async function sendBetaApprovalEmail(input: {
  to: string;
  recipientName: string;
}) {
  const config = getApprovalEmailConfig();
  if (!config) {
    console.warn(
      "Beta approval email skipped because RESEND_API_KEY or BETA_APPROVAL_FROM_EMAIL is missing.",
    );
    return {
      sent: false,
      reason: "not-configured",
    } as const;
  }

  const resend = new Resend(config.apiKey);
  const message = buildApprovalEmail(input);

  const result = await resend.emails.send({
    from: config.from,
    to: input.to,
    replyTo: config.replyTo,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  if (result.error) {
    throw new Error(
      `Resend rejected beta approval email: ${result.error.message}`,
    );
  }

  if (!result.data?.id) {
    throw new Error("Resend did not return a message id.");
  }

  return {
    sent: true,
    id: result.data.id,
  } as const;
}

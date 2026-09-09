"use server";

import { Resend } from "resend";
import { getBetaDiscordInviteUrl } from "@/lib/beta-community";

function getBaseUrl() {
  return (process.env.APP_URL || "http://localhost:3001").replace(/\/+$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getEmailConfig() {
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
  const discordInviteUrl = getBetaDiscordInviteUrl();

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
  const config = getEmailConfig();
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

const FEEDBACK_STATUS_LABELS = {
  NEW: "New",
  IN_REVIEW: "In review",
  WAITING: "Waiting",
  DONE: "Done",
  DECLINED: "Declined",
} as const;

function buildFeedbackStatusEmail({
  recipientName,
  status,
  title,
}: {
  recipientName: string;
  status: keyof typeof FEEDBACK_STATUS_LABELS;
  title: string;
}) {
  const feedbackUrl = `${getBaseUrl()}/feedback`;
  const greeting = recipientName.trim() || "there";
  const label = FEEDBACK_STATUS_LABELS[status];
  const safeGreeting = escapeHtml(greeting);
  const safeTitle = escapeHtml(title);
  const safeFeedbackUrl = escapeHtml(feedbackUrl);

  return {
    subject: `Your filazo feedback was moved to ${label}`,
    text: [
      `Hi ${greeting},`,
      "",
      `Your feedback “${title}” is now marked as: ${label}.`,
      `You can review your submissions here: ${feedbackUrl}`,
      "",
      "filazo",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <p>Hi ${safeGreeting},</p>
        <p>Your feedback <strong>“${safeTitle}”</strong> is now marked as: <strong>${label}</strong>.</p>
        <p><a href="${safeFeedbackUrl}">Review your feedback submissions</a></p>
        <p>filazo</p>
      </div>
    `,
  };
}

export async function sendFeedbackStatusEmail(input: {
  to: string;
  recipientName: string;
  status: keyof typeof FEEDBACK_STATUS_LABELS;
  title: string;
}) {
  const config = getEmailConfig();
  if (!config) {
    console.warn(
      "Feedback status email skipped because RESEND_API_KEY or BETA_APPROVAL_FROM_EMAIL is missing.",
    );
    return { sent: false, reason: "not-configured" } as const;
  }

  const resend = new Resend(config.apiKey);
  const message = buildFeedbackStatusEmail(input);
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
      `Resend rejected feedback status email: ${result.error.message}`,
    );
  }

  if (!result.data?.id) {
    throw new Error("Resend did not return a message id.");
  }

  return { sent: true, id: result.data.id } as const;
}

export async function sendFeedbackCommentEmail(input: {
  to: string;
  recipientName: string;
  title: string;
  body: string;
  authorLabel: string;
  recipientPath: "/feedback" | "/admin/feedback";
}) {
  const config = getEmailConfig();
  if (!config) {
    console.warn(
      "Feedback comment email skipped because RESEND_API_KEY or BETA_APPROVAL_FROM_EMAIL is missing.",
    );
    return { sent: false, reason: "not-configured" } as const;
  }

  const feedbackUrl = `${getBaseUrl()}${input.recipientPath}`;
  const greeting = input.recipientName.trim() || "there";
  const safeGreeting = escapeHtml(greeting);
  const safeTitle = escapeHtml(input.title);
  const safeBody = escapeHtml(input.body).replaceAll("\n", "<br />");
  const safeAuthorLabel = escapeHtml(input.authorLabel);
  const safeFeedbackUrl = escapeHtml(feedbackUrl);
  const message = {
    subject: `New reply on your filazo feedback: ${input.title}`,
    text: [
      `Hi ${greeting},`,
      "",
      `${input.authorLabel} replied to “${input.title}”:`,
      input.body,
      "",
      `Open the conversation: ${feedbackUrl}`,
      "",
      "filazo",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <p>Hi ${safeGreeting},</p>
        <p><strong>${safeAuthorLabel}</strong> replied to <strong>“${safeTitle}”</strong>:</p>
        <p>${safeBody}</p>
        <p><a href="${safeFeedbackUrl}">Open the conversation</a></p>
        <p>filazo</p>
      </div>
    `,
  };

  const resend = new Resend(config.apiKey);
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
      `Resend rejected feedback comment email: ${result.error.message}`,
    );
  }

  if (!result.data?.id) {
    throw new Error("Resend did not return a message id.");
  }

  return { sent: true, id: result.data.id } as const;
}

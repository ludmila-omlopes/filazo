import { isIP } from "node:net";

export const ABUSE_LIMITS = {
  loginIp: { name: "login-ip", limit: 30, windowSeconds: 900 },
  loginEmail: { name: "login-email", limit: 10, windowSeconds: 900 },
  anonymousFeedback: { name: "anonymous-feedback", limit: 3, windowSeconds: 3600 },
  feedback: { name: "feedback", limit: 10, windowSeconds: 3600 },
  feedbackComment: { name: "feedback-comment", limit: 20, windowSeconds: 3600 },
  gameSearch: { name: "game-search", limit: 60, windowSeconds: 60 },
  assistant: { name: "assistant", limit: 10, windowSeconds: 60 },
  marketplaceRefresh: { name: "marketplace-refresh", limit: 3, windowSeconds: 86400 },
  steamReviewsBurst: { name: "steam-reviews-burst", limit: 10, windowSeconds: 60 },
  steamReviewsRefresh: { name: "steam-reviews-refresh", limit: 3, windowSeconds: 86400 },
  csvImport: { name: "csv-import", limit: 3, windowSeconds: 3600 },
  uploadBurst: { name: "upload-burst", limit: 10, windowSeconds: 60 },
  uploadDaily: { name: "upload-daily", limit: 50, windowSeconds: 86400 },
  uploadDelete: { name: "upload-delete", limit: 20, windowSeconds: 60 },
} as const;

export type AbusePolicy = { name: string; limit: number; windowSeconds: number };

export function getClientNetwork(
  headers: Pick<Headers, "get">,
  env: { VERCEL?: string; RATE_LIMIT_TRUSTED_IP_HEADER?: string } = {
    VERCEL: process.env.VERCEL,
    RATE_LIMIT_TRUSTED_IP_HEADER: process.env.RATE_LIMIT_TRUSTED_IP_HEADER,
  },
) {
  // Only trust headers overwritten by our ingress, never arbitrary client IPs.
  const header = env.VERCEL === "1"
    ? "x-vercel-forwarded-for"
    : env.RATE_LIMIT_TRUSTED_IP_HEADER?.trim().toLowerCase();
  const ip = header ? headers.get(header)?.trim() ?? "" : "";
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6) return "unknown-network";

  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split("::");
  const start = left ? left.split(":") : [];
  const end = right ? right.split(":") : [];
  const groups = right === undefined ? start : [
    ...start, ...Array<string>(8 - start.length - end.length).fill("0"), ...end,
  ];
  const numbers = groups.map((group) => parseInt(group, 16));
  if (numbers.slice(0, 5).every((value) => value === 0) && numbers[5] === 65535) {
    return [numbers[6] >> 8, numbers[6] & 255, numbers[7] >> 8, numbers[7] & 255].join(".");
  }
  // Group IPv6 privacy addresses so rotating the host bits cannot reset limits.
  return `${numbers.slice(0, 4).map((value) => value.toString(16)).join(":")}::/64`;
}

export function abuseMessage(locale: string, unavailable = false) {
  if (locale === "pt-BR") {
    return unavailable
      ? "Não foi possível verificar o limite agora. Tente novamente em um minuto."
      : "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }
  return unavailable
    ? "Could not check the limit right now. Please try again in a minute."
    : "Too many attempts in a short time. Please wait a few minutes and try again.";
}

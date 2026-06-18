import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

type GoogleTokenResponse = {
  id_token?: string;
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export type GoogleProfile = {
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export function isGoogleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function getGoogleClientId() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("Set GOOGLE_CLIENT_ID before using Google login.");
  }

  return clientId;
}

function getGoogleClientSecret() {
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("Set GOOGLE_CLIENT_SECRET before using Google login.");
  }

  return clientSecret;
}

export function getGoogleRedirectUri(origin: string) {
  return `${origin}/api/auth/google/callback`;
}

export function getYoutubeRedirectUri(origin: string) {
  return `${origin}/api/auth/youtube/callback`;
}

export function createGoogleAuthUrl({
  nonce,
  origin,
  redirectUri = getGoogleRedirectUri(origin),
  scope = "openid email profile",
  state,
}: {
  nonce: string;
  origin: string;
  redirectUri?: string;
  scope?: string;
  state: string;
}) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", getGoogleClientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("prompt", "select_account");

  return url.toString();
}

export async function exchangeGoogleCodeForProfile({
  code,
  nonce,
  origin,
  redirectUri = getGoogleRedirectUri(origin),
}: {
  code: string;
  nonce: string;
  origin: string;
  redirectUri?: string;
}): Promise<GoogleProfile> {
  const body = new URLSearchParams({
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Google login could not exchange the authorization code.");
  }

  const token = (await response.json()) as GoogleTokenResponse;
  if (!token.id_token) {
    throw new Error("Google login did not return an identity token.");
  }

  const { payload } = await jwtVerify(token.id_token, GOOGLE_JWKS, {
    audience: getGoogleClientId(),
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });

  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    payload.email_verified !== true ||
    payload.nonce !== nonce
  ) {
    throw new Error("Google account email could not be verified.");
  }

  return {
    subject: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: true,
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}

export async function upsertGoogleUser(
  profile: GoogleProfile,
  {
    allowCreate = false,
    registrationClosedMessage = "Public registrations are closed. Use the beta tester signup.",
  }: { allowCreate?: boolean; registrationClosedMessage?: string } = {},
) {
  const existingByGoogle = await prisma.user.findUnique({
    where: { googleSubject: profile.subject },
  });

  if (existingByGoogle) {
    return prisma.user.update({
      where: { id: existingByGoogle.id },
      data: {
        email: existingByGoogle.email ?? profile.email,
        displayName: profile.name ?? existingByGoogle.displayName ?? undefined,
        avatarUrl: profile.picture ?? existingByGoogle.avatarUrl ?? undefined,
      },
    });
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email: profile.email },
  });

  if (existingByEmail) {
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        googleSubject: profile.subject,
        displayName: existingByEmail.displayName ?? profile.name ?? undefined,
        avatarUrl: existingByEmail.avatarUrl ?? profile.picture ?? undefined,
      },
    });
  }

  if (!allowCreate) {
    throw new Error(registrationClosedMessage);
  }

  return prisma.user.create({
    data: {
      email: profile.email,
      googleSubject: profile.subject,
      displayName: profile.name ?? profile.email.split("@")[0],
      avatarUrl: profile.picture,
    },
  });
}

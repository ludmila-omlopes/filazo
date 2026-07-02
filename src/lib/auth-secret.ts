const DEV_FALLBACK_SECRET = "local-dev-secret-change-me";

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.trim().length >= 16) {
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    return DEV_FALLBACK_SECRET;
  }

  throw new Error(
    "AUTH_SECRET is not configured. Set a long random AUTH_SECRET environment variable before running filazo in production.",
  );
}

import * as Sentry from "@sentry/nextjs";

export type AuthProvider = "google" | "youtube";

export type AuthFailureStage =
  | "start-auth"
  | "callback-parameters"
  | "verify-state"
  | "exchange-code"
  | "load-user"
  | "create-session"
  | "unknown";

export type AuthFailureReason = "missing-code" | "invalid-state" | "provider-error";

const OAUTH_ERROR_CODES = new Set([
  "access_denied",
  "admin_policy_enforced",
  "disallowed_useragent",
  "invalid_request",
  "invalid_scope",
  "login_required",
  "interaction_required",
  "server_error",
  "temporarily_unavailable",
  "unauthorized_client",
  "unsupported_response_type",
]);

type AuthFailureContext = {
  provider: AuthProvider;
  route: string;
  stage: AuthFailureStage;
  requestId: string;
  reason?: AuthFailureReason;
  providerError?: string;
};

type AuthExceptionContext = {
  level: "error";
  tags: Record<string, string>;
  extra: { requestId: string };
};

type CaptureAuthException = (
  error: Error,
  context: AuthExceptionContext,
) => string | undefined;

export function reportAuthFailure(
  error: unknown,
  context: AuthFailureContext,
  captureException: CaptureAuthException = (receivedError, captureContext) =>
    Sentry.captureException(receivedError, captureContext),
) {
  try {
    void error;
    const sanitizedError = new Error(
      `${context.provider} authentication callback failed at ${context.stage}`,
    );
    sanitizedError.name = "AuthenticationCallbackError";

    return captureException(sanitizedError, {
      level: "error",
      tags: {
        "filazo.area": "authentication",
        "filazo.provider": context.provider,
        "filazo.route": context.route,
        "filazo.auth_stage": context.stage,
        ...(context.reason ? { "filazo.auth_reason": context.reason } : {}),
        ...(context.providerError !== undefined
          ? {
              "filazo.oauth_error": OAUTH_ERROR_CODES.has(context.providerError)
                ? context.providerError
                : "unknown",
            }
          : {}),
      },
      extra: { requestId: context.requestId },
    });
  } catch {
    // Monitoring must never replace the authentication fallback response.
    return undefined;
  }
}

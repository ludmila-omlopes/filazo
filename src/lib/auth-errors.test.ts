import assert from "node:assert/strict";
import { test } from "node:test";
import { reportAuthFailure } from "./auth-errors.ts";

test("reports Google callback failures without copying OAuth details", () => {
  const original = new Error("token=secret-code&email=private@example.com");
  let capturedError: Error | undefined;
  let capturedContext: unknown;

  const eventId = reportAuthFailure(
    original,
    {
      provider: "google",
      route: "/api/auth/google/callback",
      stage: "exchange-code",
      requestId: "request-123",
    },
    (error, context) => {
      capturedError = error;
      capturedContext = context;
      return "event-123";
    },
  );

  assert.equal(eventId, "event-123");
  assert.ok(capturedError);
  assert.equal(capturedError.name, "AuthenticationCallbackError");
  assert.equal(
    capturedError.message,
    "google authentication callback failed at exchange-code",
  );
  assert.equal(capturedError.message.includes("secret-code"), false);
  assert.deepEqual(capturedContext, {
    level: "error",
    tags: {
      "filazo.area": "authentication",
      "filazo.provider": "google",
      "filazo.route": "/api/auth/google/callback",
      "filazo.auth_stage": "exchange-code",
    },
    extra: { requestId: "request-123" },
  });
});

test("monitoring failures do not replace the auth fallback", () => {
  assert.doesNotThrow(() =>
    reportAuthFailure(
      new Error("failure"),
      {
        provider: "google",
        route: "/api/auth/google/callback",
        stage: "unknown",
        requestId: "request-123",
      },
      () => {
        throw new Error("monitoring unavailable");
      },
    ),
  );
});

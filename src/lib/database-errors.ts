import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";
import { createTranslator, type Locale } from "./i18n.ts";

type DatabaseErrorContext = {
  operation: string;
  route: string;
};

type DatabaseErrorCaptureContext = {
  level: "error";
  tags: Record<string, string>;
  extra: { userMessage: string };
};

type CaptureDatabaseException = (
  error: unknown,
  context: DatabaseErrorCaptureContext,
) => string;

export function isUniqueConstraintViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function getDatabaseErrorMessage(error: unknown, locale: Locale = "en") {
  // Technical details belong exclusively in monitoring, never in product copy.
  void error;
  return createTranslator(locale)("profile.error.body");
}

function getPrismaErrorCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^P\d{4}$/.test(error.code)
  ) {
    return error.code;
  }

  const message = error instanceof Error ? error.message : String(error);
  return message.match(/\bP\d{4}\b/)?.[0] ?? "UNKNOWN";
}

function createSanitizedDatabaseError(prismaCode: string) {
  const sanitizedError = new Error(`Database operation failed (${prismaCode})`);
  sanitizedError.name = "DatabaseOperationError";
  return sanitizedError;
}

export function reportDatabaseError(
  error: unknown,
  context: DatabaseErrorContext,
  captureException: CaptureDatabaseException = (receivedError, captureContext) =>
    Sentry.captureException(receivedError, captureContext),
) {
  try {
    const prismaCode = getPrismaErrorCode(error);
    return captureException(createSanitizedDatabaseError(prismaCode), {
      level: "error",
      tags: {
        "filazo.area": "database",
        "filazo.operation": context.operation,
        "filazo.route": context.route,
        "prisma.code": prismaCode,
      },
      extra: {
        userMessage: getDatabaseErrorMessage(error),
      },
    });
  } catch {
    // Monitoring must never replace the application's existing fallback UI.
    return undefined;
  }
}

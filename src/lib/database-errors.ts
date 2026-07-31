import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";

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

export function getDatabaseErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const prismaCode = getPrismaErrorCode(error);

  if (message.includes("Environment variable not found: DATABASE_URL")) {
    return "Database is not configured. Set DATABASE_URL to a PostgreSQL connection string.";
  }

  if (
    message.includes("the URL must start with the protocol") ||
    message.includes("the URL must start with protocol") ||
    message.includes("must start with `postgresql://`") ||
    message.includes("must start with `postgres://`") ||
    message.includes("Error validating datasource")
  ) {
    return "Database URL must use PostgreSQL. Set DATABASE_URL to a postgresql:// connection string and run npm run db:init.";
  }

  if (
    message.includes("no such table") ||
    message.includes("does not exist in the current database") ||
    prismaCode === "P2021" ||
    prismaCode === "P2022"
  ) {
    return "Database schema is not initialized. Run the database setup before using catalog features.";
  }

  if (
    message.includes("Can't reach database server") ||
    message.includes("Timed out fetching a new connection") ||
    prismaCode === "P1001" ||
    prismaCode === "P2024"
  ) {
    return "Database is unavailable. Check the PostgreSQL connection and retry.";
  }

  return "Database is unavailable. Check DATABASE_URL and the PostgreSQL database setup.";
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

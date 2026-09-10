import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import {
  isUniqueConstraintViolation,
  getDatabaseErrorMessage,
  reportDatabaseError,
} from "./database-errors.ts";

test("detects a P2002 known request error", () => {
  const error = new Prisma.PrismaClientKnownRequestError("Unique failed", {
    code: "P2002",
    clientVersion: "0.0.0",
  });
  assert.equal(isUniqueConstraintViolation(error), true);
});

test("reports handled database errors with safe operational context", () => {
  const error = new Prisma.PrismaClientKnownRequestError(
    "The column User.lastActiveAt does not exist",
    {
      code: "P2022",
      clientVersion: "0.0.0",
    },
  );
  error.stack = [
    "PrismaClientKnownRequestError: private query payload",
    "    at private-user-data",
  ].join("\n");
  let capturedError: unknown;
  let capturedContext: unknown;

  const eventId = reportDatabaseError(
    error,
    { operation: "load-profile", route: "/profile" },
    (receivedError, context) => {
      capturedError = receivedError;
      capturedContext = context;
      return "event-id";
    },
  );

  assert.equal(eventId, "event-id");
  assert.ok(capturedError instanceof Error);
  assert.notEqual(capturedError, error);
  assert.equal(capturedError.name, "DatabaseOperationError");
  assert.equal(capturedError.message, "Database operation failed (P2022)");
  assert.equal(capturedError.stack?.includes("private query payload"), false);
  assert.equal(capturedError.stack?.includes("private-user-data"), false);
  assert.deepEqual(capturedContext, {
    level: "error",
    tags: {
      "filazo.area": "database",
      "filazo.operation": "load-profile",
      "filazo.route": "/profile",
      "prisma.code": "P2022",
    },
    extra: {
      userMessage:
        "We are having a technical problem with the site. No changes to your account are needed. Please try again later or contact site support.",
    },
  });
});

test("monitoring failures do not replace the database fallback", () => {
  const databaseError = Object.assign(new Error("database unavailable"), {
    code: "P1001",
  });

  assert.doesNotThrow(() =>
    reportDatabaseError(
      databaseError,
      { operation: "load-home-catalog", route: "/" },
      () => {
        throw new Error("monitoring unavailable");
      },
    ),
  );
});

test("unusual error objects cannot escape monitoring isolation", () => {
  const hostileError = Object.create(null, {
    code: {
      get() {
        throw new Error("hostile code getter");
      },
    },
  });

  let captureCalled = false;
  assert.doesNotThrow(() =>
    reportDatabaseError(
      hostileError,
      { operation: "load-home-catalog", route: "/" },
      () => {
        captureCalled = true;
        return "unreachable";
      },
    ),
  );
  assert.equal(captureCalled, false);
});

test("rejects other errors", () => {
  assert.equal(isUniqueConstraintViolation(new Error("P2002")), false);
  const error = new Prisma.PrismaClientKnownRequestError("Not found", {
    code: "P2025",
    clientVersion: "0.0.0",
  });
  assert.equal(isUniqueConstraintViolation(error), false);
});

test("all database failures show localized support copy without setup instructions", () => {
  for (const code of ["P1001", "P2021", "P2022", "P2024", "UNKNOWN"]) {
    const error = Object.assign(new Error("private postgresql://user:secret@host/db DATABASE_URL"), { code });
    for (const locale of ["en", "pt-BR"] as const) {
      const message = getDatabaseErrorMessage(error, locale);
      assert.doesNotMatch(message, /postgres|DATABASE_URL|schema|npm|secret|P2022/i);
      assert.match(message, locale === "en" ? /site support/ : /suporte do site/);
    }
  }
});

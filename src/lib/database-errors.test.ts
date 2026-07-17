import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { isUniqueConstraintViolation } from "./database-errors.ts";

test("detects a P2002 known request error", () => {
  const error = new Prisma.PrismaClientKnownRequestError("Unique failed", {
    code: "P2002",
    clientVersion: "0.0.0",
  });
  assert.equal(isUniqueConstraintViolation(error), true);
});

test("rejects other errors", () => {
  assert.equal(isUniqueConstraintViolation(new Error("P2002")), false);
  const error = new Prisma.PrismaClientKnownRequestError("Not found", {
    code: "P2025",
    clientVersion: "0.0.0",
  });
  assert.equal(isUniqueConstraintViolation(error), false);
});

import type { AccountPlan } from "@prisma/client";

export type PlanAccount = { plan: AccountPlan };

export function hasProAccess(user: PlanAccount | null | undefined): boolean {
  return user?.plan === "PRO";
}

export class ProRequiredError extends Error {
  readonly code = "PRO_REQUIRED";

  constructor() {
    super("This feature requires a Pro account.");
    this.name = "ProRequiredError";
  }
}

export function assertProAccess(user: PlanAccount | null | undefined): asserts user is PlanAccount {
  if (!hasProAccess(user)) throw new ProRequiredError();
}

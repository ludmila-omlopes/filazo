import type { AccountPlan } from "@prisma/client";
import { billingLiveMode, hasPaidProAccess, type PaidSubscription } from "./billing-policy.ts";

export type PlanAccount = { plan: AccountPlan; billingSubscriptions?: PaidSubscription[] };

export function hasProAccess(user: PlanAccount | null | undefined, now = new Date(), livemode = billingLiveMode()): boolean {
  return user?.plan === "PRO" || !!user?.billingSubscriptions?.some(
    (subscription) => hasPaidProAccess(subscription, now, livemode),
  );
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

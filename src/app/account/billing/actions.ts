"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canAccessPlatform, getSessionUserWithBeta } from "@/lib/beta-access";
import { getSessionUserId } from "@/lib/session";
import { BillingError, getBillingService } from "@/lib/billing-service";

async function billingUser() {
  const user = await getSessionUserWithBeta(await getSessionUserId());
  if (!user) redirect("/login");
  return user;
}

export async function startProCheckoutAction(formData: FormData) {
  const user = await billingUser();
  if (!canAccessPlatform(user)) redirect("/beta");
  if (formData.get("brazilConsent") !== "BR") redirect("/account/billing?error=consent");
  let url: string;
  try {
    url = await getBillingService().startCheckout(user.id);
  } catch (error) {
    const code = error instanceof BillingError ? error.code : "unavailable";
    redirect(`/account/billing?error=${code}`);
  }
  redirect(url);
}

export async function manageSubscriptionAction() {
  // Even an expired beta user must be able to cancel their paid subscription.
  const user = await billingUser();
  let url: string;
  try {
    url = await getBillingService().openPortal(user.id);
  } catch {
    redirect("/account/billing?error=portal");
  }
  redirect(url);
}

export async function refreshSubscriptionAction() {
  const user = await billingUser();
  try {
    await getBillingService().refresh(user.id);
  } catch {
    redirect("/account/billing?error=refresh");
  }
  revalidatePath("/account/billing");
  revalidatePath("/profile");
  redirect("/account/billing");
}

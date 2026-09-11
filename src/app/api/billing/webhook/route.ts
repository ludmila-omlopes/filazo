import { getBillingConfig, getStripe } from "@/lib/billing-config";
import { getBillingService } from "@/lib/billing-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const config = getBillingConfig();
  if (!config.secretKey || !config.webhookSecret) return new Response("Billing unavailable", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  if (Number(request.headers.get("content-length")) > 1_048_576) return new Response("Payload too large", { status: 413 });
  const body = await request.text();
  if (body.length > 1_048_576) return new Response("Payload too large", { status: 413 });
  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, config.webhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    await getBillingService().handleEvent(event);
    return Response.json({ received: true });
  } catch {
    // A failed transaction is not acknowledged; Stripe can safely retry it.
    console.error("Billing webhook processing failed", { eventId: event.id, type: event.type });
    return new Response("Unable to process event", { status: 500 });
  }
}

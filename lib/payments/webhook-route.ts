import "server-only";
import { paymentRuntime } from "./client";
import { processSnapshotEvent, processThinEvent, readWebhookBody } from "./webhooks";

export async function handleStripeWebhook(
  request: Request,
  mode: "platform" | "connect" | "accounts-v2",
) {
  const name =
    mode === "platform"
      ? "STRIPE_WEBHOOK_SECRET_PLATFORM"
      : mode === "connect"
        ? "STRIPE_WEBHOOK_SECRET_CONNECT"
        : "STRIPE_WEBHOOK_SECRET_ACCOUNTS_V2";
  const secret = process.env[name];
  const signature = request.headers.get("stripe-signature");
  if (!secret) return new Response("Webhook is not configured.", { status: 503 });
  if (!signature) return new Response("Invalid signature.", { status: 400 });
  let runtime: ReturnType<typeof paymentRuntime>;
  try {
    runtime = paymentRuntime(true);
  } catch {
    return new Response("Payments are not configured.", { status: 503 });
  }
  let raw: string;
  try {
    raw = await readWebhookBody(request);
  } catch {
    return new Response("Invalid body.", { status: 400 });
  }
  if (mode === "accounts-v2") {
    let notification;
    try {
      notification = runtime.stripe.parseEventNotification(raw, signature, secret);
    } catch {
      return new Response("Invalid signature.", { status: 400 });
    }
    try {
      await processThinEvent(notification);
    } catch {
      return new Response("Reconciliation must be retried.", { status: 500 });
    }
  } else {
    let event;
    try {
      event = runtime.stripe.webhooks.constructEvent(raw, signature, secret);
    } catch {
      return new Response("Invalid signature.", { status: 400 });
    }
    try {
      await processSnapshotEvent(event, mode === "connect");
    } catch {
      return new Response("Reconciliation must be retried.", { status: 500 });
    }
  }
  return Response.json({ received: true });
}

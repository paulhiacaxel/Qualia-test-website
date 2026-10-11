import { handleStripeWebhook } from "@/lib/payments/webhook-route";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleStripeWebhook(request, "accounts-v2");
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { paymentCommand } from "./store";
import { checkoutReservationSchema, operationSchema, type PaymentActionState } from "./contracts";
import { paymentConfig } from "./config";
import { executeRefundAndRecovery, executeSettlement } from "./settlement";
import { syncRecipient } from "./service";
import { reconcileCheckout, recoverCheckoutReference } from "./webhooks";

const command = z.object({
  bookingId: z.uuid(),
  operationId: z.uuid(),
  action: z.enum(["complete", "release", "refund", "reconcile", "expire", "resume", "recover"]),
});
export async function administerPayment(
  _previous: PaymentActionState,
  form: FormData,
): Promise<PaymentActionState> {
  const user = await requireAdmin();
  const parsed = command.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Choose a valid payment action." };
  const config = paymentConfig(process.env, true);
  if (!config) return { error: "Payment operations are not configured." };
  const input = parsed.data;
  let message = "Payment status refreshed.";
  try {
    // Every admin action rechecks role in a narrow DB command; hidden fields confer no authority.
    await paymentCommand("pay_read_booking", {
      p_actor_id: user.id,
      p_booking_id: input.bookingId,
    });
    if (input.action === "complete") {
      await paymentCommand("pay_complete_booking", {
        p_actor_id: user.id,
        p_booking_id: input.bookingId,
      });
      message = "Experience marked complete. Earnings still require an explicit release.";
    } else if (input.action === "refund") {
      const amount = String(form.get("amount") ?? "");
      if (!/^\d{1,6}(\.\d{1,2})?$/.test(amount))
        return { error: "Enter a positive refund in dollars with at most two decimal places." };
      const [dollars, fraction = ""] = amount.split(".");
      const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
      const reason = String(form.get("reason") ?? "").trim();
      if (cents <= 0 || reason.length < 3 || reason.length > 1000)
        return { error: "Enter a positive refund and a reason (3–1,000 characters)." };
      const op = await paymentCommand("pay_prepare_refund", {
        p_actor_id: user.id,
        p_booking_id: input.bookingId,
        p_amount_cents: cents,
        p_attempt_id: z.uuid().parse(form.get("attemptId")),
        p_reason: reason,
        p_operation_id: input.operationId,
      });
      const result = await executeRefundAndRecovery(op);
      message = `Customer refund: ${result.refund}.${result.recovery ? ` Host recovery: ${result.recovery}.` : ""}`;
    } else if (input.action === "release") {
      if (!paymentConfig()) return { error: "New transfers are paused in this deployment." };
      // Refresh destination readiness before the DB checks release eligibility.
      const attemptId = z.uuid().parse(form.get("attemptId"));
      const attempt = checkoutReservationSchema.parse(
        await paymentCommand("pay_get_operation", { p_operation_id: attemptId }),
      );
      if (attempt.booking_id !== input.bookingId) throw new Error("Mismatched booking.");
      await syncRecipient(attempt.host_account_id);
      const op = await paymentCommand("pay_prepare_release", {
        p_actor_id: user.id,
        p_booking_id: input.bookingId,
        p_operation_id: input.operationId,
      });
      const result = await executeSettlement(op);
      message = `Host transfer: ${result.state}. Bank payout is a separate process.`;
    } else if (input.action === "resume") {
      let op = operationSchema.parse(
        await paymentCommand("pay_get_operation", { p_operation_id: input.operationId }),
      );
      if (op.booking_id !== input.bookingId || op.environment !== config.environment)
        throw new Error("Mismatched operation.");
      const recoveredId = String(form.get("externalId") ?? "").trim();
      if (recoveredId) {
        const prefix = op.kind === "transfer" ? "tr_" : op.kind === "refund" ? "re_" : "trr_";
        if (
          !recoveredId.startsWith(prefix) ||
          !/^[a-zA-Z0-9_]+$/.test(recoveredId) ||
          (op.external_id && op.external_id !== recoveredId)
        )
          throw new Error("Invalid provider recovery reference.");
        // This only enables canonical retrieval; metadata/amount/charge checks occur before recording.
        op = { ...op, external_id: recoveredId };
      }
      if (op.kind === "transfer" && !op.external_id) {
        if (op.state === "failed")
          throw new Error("A failed transfer needs a newly reviewed release.");
        if (!paymentConfig()) return { error: "New transfers are paused in this deployment." };
        if (op.destination) await syncRecipient(op.destination);
        // Reauthorization is mandatory: a refund or dispute can block an old queued transfer.
        op = operationSchema.parse(
          await paymentCommand("pay_prepare_release", {
            p_actor_id: user.id,
            p_booking_id: input.bookingId,
            p_operation_id: input.operationId,
          }),
        );
      }
      const result =
        op.kind === "refund" ? await executeRefundAndRecovery(op) : await executeSettlement(op);
      message =
        "refund" in result
          ? `Customer refund: ${result.refund}.${result.recovery ? ` Host recovery: ${result.recovery}.` : ""}`
          : `Operation: ${result.state}.`;
    } else {
      const attempt = checkoutReservationSchema.parse(
        await paymentCommand("pay_get_operation", { p_operation_id: input.operationId }),
      );
      if (attempt.booking_id !== input.bookingId) throw new Error("Mismatched checkout.");
      if (input.action === "recover") {
        const sessionId = z
          .string()
          .regex(/^cs_(?:test_|live_)?[A-Za-z0-9]+$/)
          .parse(form.get("sessionId"));
        if (attempt.session_id && attempt.session_id !== sessionId)
          throw new Error("Session is already attached.");
        await recoverCheckoutReference(attempt.attempt_id, input.bookingId, sessionId);
      } else {
        if (!attempt.session_id) throw new Error("No saved checkout session.");
        await reconcileCheckout(attempt.session_id, input.action === "expire");
      }
      message =
        "Checkout was reconciled against Stripe. Only a verified payment can confirm a booking.";
    }
  } catch {
    return {
      error:
        "This action is blocked or its result is not yet confirmed. Refresh this queue and reconcile the same operation. Check holds, host readiness and Stripe before retrying; do not create a replacement payment.",
    };
  }
  revalidatePath("/admin/payments");
  revalidatePath("/host/payments");
  revalidatePath(`/bookings/${input.bookingId}`);
  return { success: message };
}

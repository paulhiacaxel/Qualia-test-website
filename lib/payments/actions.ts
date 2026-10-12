"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireHost, requireUser } from "@/lib/auth/session";
import { idSchema } from "@/lib/host/validation";
import { bookingCheckout, hostDashboard, hostOnboarding, syncRecipient } from "./service";
import { paymentConfig } from "./config";
import {
  accountReservationSchema,
  checkoutTermsSchema,
  type CheckoutTermsState,
  type PaymentActionState,
} from "./contracts";
import { paymentCommand } from "./store";
import { checkoutWindow } from "@/lib/booking/payment-window";
import { getHostPaymentAccess } from "./host-access";

export async function createBookingCheckout(
  _previous: PaymentActionState,
  form: FormData,
): Promise<PaymentActionState> {
  const id = idSchema.safeParse(form.get("bookingId"));
  if (!id.success) return { error: "Choose a valid booking." };
  const policyId = idSchema.safeParse(form.get("policyId"));
  if (!policyId.success || form.get("termsAccepted") !== "on")
    return { error: "Review and accept the cancellation terms before payment." };
  const user = await requireUser(`/bookings/${id.data}`);
  const config = paymentConfig();
  if (!config)
    return {
      error: "Payments are not open yet. Please contact Qualia before your payment deadline.",
    };
  let url: string;
  try {
    const terms = checkoutTermsSchema.parse(
      await paymentCommand("pay_checkout_terms", {
        p_actor_id: user.id,
        p_booking_id: id.data,
        p_environment: config.environment,
      }),
    );
    const window = checkoutWindow(terms);
    if (window.mode === "closed")
      return {
        error:
          "There is not enough time left to open a new checkout. Contact Qualia or cancel this unpaid request and choose a later time.",
      };
    if (window.mode === "reconciling")
      return {
        error:
          "Your existing payment is being checked. Refresh the booking shortly or contact Qualia; do not make another payment.",
      };
    url = await bookingCheckout(user.id, id.data, policyId.data);
  } catch {
    return {
      error:
        "We could not open checkout. Your booking or payment settings may have changed. Refresh its status or contact Qualia; don't pay through another link.",
    };
  }
  redirect(url);
}

export async function startHostOnboarding(
  _previous: PaymentActionState,
  _form: FormData,
): Promise<PaymentActionState> {
  const { user, profile } = await requireHost();
  const access = await getHostPaymentAccess(user.id);
  if (!access?.canOnboard)
    return {
      error:
        "Payout setup is not open yet. You can complete your profile and submit your listing for review.",
    };
  let url: string;
  try {
    url = await hostOnboarding({ id: user.id, email: user.email!, name: profile.full_name });
  } catch {
    return {
      error:
        "Payment setup could not be opened. Try again to resume the same setup, or contact Qualia.",
    };
  }
  redirect(url);
}

export async function openHostPaymentDashboard(
  _previous: PaymentActionState,
  _form: FormData,
): Promise<PaymentActionState> {
  const { user } = await requireHost();
  if (!(await getHostPaymentAccess(user.id)))
    return { error: "Your Stripe payout dashboard is not available yet." };
  let url: string;
  try {
    url = await hostDashboard(user.id);
  } catch {
    return {
      error:
        "Your Stripe dashboard could not be opened. Complete payment setup first or try again shortly.",
    };
  }
  redirect(url);
}

export async function refreshHostPaymentStatus(
  _previous: PaymentActionState,
  _form: FormData,
): Promise<PaymentActionState> {
  const { user } = await requireHost();
  const access = await getHostPaymentAccess(user.id);
  if (!access) return { error: "Payout setup is not available yet." };
  try {
    const account = accountReservationSchema.parse(
      await paymentCommand("pay_prepare_account", {
        p_host_id: user.id,
        p_environment: access.config.environment,
      }),
    );
    if (!account.account_id) return { error: "Start payment setup first." };
    await syncRecipient(account.account_id);
  } catch {
    return { error: "We could not verify your payment status. Please try again shortly." };
  }
  revalidatePath("/host/payments");
  return { success: "Your payment setup status has been refreshed." };
}

/** Read-only review step: consent must refer to the same policy the database reserves. */
export async function reviewBookingPayment(
  _previous: CheckoutTermsState,
  form: FormData,
): Promise<CheckoutTermsState> {
  const id = idSchema.safeParse(form.get("bookingId"));
  if (!id.success) return { error: "Choose a valid booking." };
  const user = await requireUser(`/bookings/${id.data}`);
  const config = paymentConfig();
  if (!config)
    return { error: "Payments are not open yet. Please contact Qualia before your deadline." };
  try {
    const terms = checkoutTermsSchema.parse(
      await paymentCommand("pay_checkout_terms", {
        p_actor_id: user.id,
        p_booking_id: id.data,
        p_environment: config.environment,
      }),
    );
    return { terms };
  } catch {
    return { error: "The payment terms are unavailable. Refresh your booking or contact Qualia." };
  }
}

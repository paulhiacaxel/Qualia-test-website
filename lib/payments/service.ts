import "server-only";
import { getSiteUrl } from "@/lib/supabase/config";
import { paymentRuntime } from "./client";
import { paymentCommand } from "./store";
import { accountReservationSchema, checkoutReservationSchema } from "./contracts";
import { assertCreationRetryWindow, assertMode, stripeRedirectUrl } from "./config";
import { accountReadiness, objectId } from "./canonical";
import { getHostPaymentAccess } from "./host-access";
import {
  createCheckoutSession,
  createOnboardingLink,
  createRecipient,
  retrieveRecipient,
} from "./gateway";

function siteOrigin() {
  const origin = getSiteUrl();
  if (!origin) throw new Error("Payments require the site's verified address.");
  return origin;
}

export async function syncRecipient(accountId: string) {
  const { stripe, config } = paymentRuntime(true);
  const account = await retrieveRecipient(stripe, accountId, config.environment);
  const readiness = accountReadiness(account);
  await paymentCommand("pay_sync_account", {
    p_account_id: accountId,
    p_environment: config.environment,
    p_transfers_active: readiness.transfersActive,
    p_payouts_active: readiness.payoutsActive,
    p_requirements_due: { currently_due: readiness.requirementsDue },
  });
  return readiness;
}

export async function hostOnboarding(input: { id: string; email: string; name: string }) {
  const access = await getHostPaymentAccess(input.id);
  if (!access?.canOnboard) throw new Error("Host payout onboarding is not open.");
  const { stripe, config } = paymentRuntime(true);
  const origin = siteOrigin();
  const reservation = accountReservationSchema.parse(
    await paymentCommand("pay_prepare_account", {
      p_host_id: input.id,
      p_environment: config.environment,
    }),
  );
  let accountId = reservation.account_id;
  if (!accountId) {
    assertCreationRetryWindow(reservation.created_at);
    const account = await createRecipient(stripe, {
      hostId: input.id,
      operationId: reservation.operation_id,
      email: input.email,
      displayName: input.name,
    });
    assertMode(account.livemode, config.environment);
    await paymentCommand("pay_attach_account", {
      p_operation_id: reservation.operation_id,
      p_account_id: account.id,
    });
    accountId = account.id;
  }
  await syncRecipient(accountId);
  return createOnboardingLink(stripe, accountId, origin);
}

export async function hostDashboard(hostId: string) {
  if (!(await getHostPaymentAccess(hostId))) throw new Error("Host payout access is unavailable.");
  const { stripe, config } = paymentRuntime(true);
  const reservation = accountReservationSchema.parse(
    await paymentCommand("pay_prepare_account", {
      p_host_id: hostId,
      p_environment: config.environment,
    }),
  );
  if (!reservation.account_id) throw new Error("Finish payment setup first.");
  const link = await stripe.accounts.createLoginLink(reservation.account_id);
  return stripeRedirectUrl(link.url, "connect");
}

export async function bookingCheckout(actorId: string, bookingId: string, policyId: string) {
  const { stripe, config } = paymentRuntime();
  const origin = siteOrigin();
  const terms = await paymentCommand<{ host_account_id: string | null }>("pay_checkout_terms", {
    p_actor_id: actorId,
    p_booking_id: bookingId,
    p_environment: config.environment,
  });
  if (!terms.host_account_id) throw new Error("Host payment setup is incomplete.");
  await syncRecipient(terms.host_account_id);
  // Reservation SQL performs the money/permission checks and locks the promotion grant.
  const quote = checkoutReservationSchema.parse(
    await paymentCommand("pay_reserve_checkout", {
      p_actor_id: actorId,
      p_booking_id: bookingId,
      p_environment: config.environment,
      p_policy_id: policyId,
      p_terms_accepted: true,
    }),
  );
  if (quote.guest_id !== actorId || quote.booking_id !== bookingId)
    throw new Error("Invalid booking payment reference.");
  const readiness = await syncRecipient(quote.host_account_id);
  if (!readiness.transfersActive || !readiness.payoutsActive)
    throw new Error("Your host's payment setup needs attention. Contact Qualia.");
  if (quote.session_id) {
    const existing = await stripe.checkout.sessions.retrieve(quote.session_id);
    assertMode(existing.livemode, config.environment);
    if (existing.metadata?.qualia_attempt_id !== quote.attempt_id)
      throw new Error("Invalid payment reference.");
    if (existing.status !== "open" || !existing.url)
      throw new Error("This payment is being reconciled. Refresh the booking shortly.");
    return stripeRedirectUrl(existing.url, "checkout");
  }
  assertCreationRetryWindow(quote.created_at);
  const { session, url } = await createCheckoutSession(
    stripe,
    {
      ...quote,
      title: quote.listing_title,
      stripe_account_id: quote.host_account_id,
    },
    origin,
  );
  assertMode(session.livemode, config.environment);
  await paymentCommand("pay_attach_checkout", {
    p_attempt_id: quote.attempt_id,
    p_session_id: session.id,
    p_payment_intent_id: objectId(session.payment_intent),
    p_url: url,
    p_expires_at: new Date(session.expires_at * 1000).toISOString(),
  });
  return url;
}

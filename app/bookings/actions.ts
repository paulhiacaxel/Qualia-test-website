"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireHost, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requireAdultAccount } from "@/lib/participation/data";
import { idSchema } from "@/lib/host/validation";
import {
  bookingMessageSchema,
  bookingRequestSchema,
  bookingRequestInput,
  bookingResponseSchema,
} from "@/lib/booking/validation";
import type { BookingActionState } from "@/lib/booking/types";

function refreshBooking(id: string) {
  revalidatePath(`/bookings/${id}`);
  revalidatePath("/bookings");
  revalidatePath("/host/calendar");
  revalidatePath("/account/dashboard");
}

export async function requestBooking(
  _previous: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const parsed = bookingRequestSchema.safeParse(bookingRequestInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await requireUser(`/experiences/${parsed.data.listingId}`);
  await requireAdultAccount(`/experiences/${parsed.data.listingId}`);
  if (formData.get("requestConfirmed") !== "on")
    return { error: "Confirm that you understand this is a booking request." };
  let bookingId: string;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("request_booking", {
      p_listing_id: parsed.data.listingId,
      p_starts_at: parsed.data.startsAt,
      p_guest_message: parsed.data.guestMessage,
      p_participant: parsed.data.participant,
    });
    if (error) {
      if (error.code === "40001")
        return {
          error:
            "The participation rules changed. Refresh the experience, read the current rules, and request again.",
        };
      if (error.code === "22023")
        return {
          error:
            "Check the participant's age at the experience and the required guardian confirmations.",
        };
      if (error.code === "42501")
        return {
          error: "Confirm your adult account eligibility before requesting this experience.",
        };
      if (error.code === "QL001")
        return {
          error:
            "This time is too close to the start to complete a booking. Refresh the calendar and choose a later time.",
        };
      if (error.code === "23P01" || error.code === "23505")
        return {
          error:
            "That time was just taken. Refresh the calendar and choose another available time.",
        };
      if (error.code === "55000")
        return {
          error:
            "This experience is not available for requests under its current participation rules. Refresh the page or choose another date.",
        };
      return {
        error:
          "We could not send your request. Check that the time is still available and that you are not booking your own experience.",
      };
    }
    if (!idSchema.safeParse(data).success)
      return { error: "We could not confirm your request. Check My bookings before trying again." };
    bookingId = data as string;
  } catch {
    return { error: "Your request could not be confirmed. Check My bookings before trying again." };
  }
  refreshBooking(bookingId);
  redirect(`/bookings/${bookingId}`);
}

export async function respondToBooking(
  _previous: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  await requireHost();
  const parsed = bookingResponseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choose a valid booking request and response." };
  if (parsed.data.decision === "accept")
    await requireAdultAccount(`/bookings/${parsed.data.bookingId}`);
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("respond_booking", {
      p_booking_id: parsed.data.bookingId,
      p_decision: parsed.data.decision,
    });
    if (error?.code === "QL001")
      return {
        error:
          "This request no longer leaves enough time to start payment. Decline it or ask the guest to request a later time.",
      };
    if (error)
      return {
        error:
          "This request could not be updated. It may have expired, been cancelled, or already been answered. Refresh to see its current status.",
      };
  } catch {
    return {
      error: "We could not confirm your response. Refresh the booking before trying again.",
    };
  }
  refreshBooking(parsed.data.bookingId);
  return {
    success:
      parsed.data.decision === "accept"
        ? "Request accepted. The guest must complete payment before the booking is confirmed."
        : "Request declined. The time is available again.",
  };
}

export async function cancelUnpaidBooking(
  _previous: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const id = idSchema.safeParse(formData.get("bookingId"));
  if (!id.success) return { error: "This booking could not be found." };
  await requireUser(`/bookings/${id.data}`);
  if (formData.get("cancelConfirmed") !== "on")
    return { error: "Confirm that you want to cancel this unpaid request." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_unpaid_booking", { p_booking_id: id.data });
    if (error)
      return {
        error:
          "This request cannot be cancelled here. It may have changed or already been paid. Refresh to check its status.",
      };
  } catch {
    return {
      error: "We could not confirm the cancellation. Refresh the booking before trying again.",
    };
  }
  refreshBooking(id.data);
  return { success: "The unpaid booking request is cancelled." };
}

export async function sendBookingMessage(
  _previous: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const parsed = bookingMessageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await requireUser(`/bookings/${parsed.data.bookingId}`);
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("send_booking_message", {
      p_booking_id: parsed.data.bookingId,
      p_body: parsed.data.body,
    });
    if (error)
      return {
        error:
          "Your message could not be sent. Check that this conversation is still available, then try again.",
      };
  } catch {
    return {
      error:
        "We could not confirm whether the message was sent. Refresh the conversation before sending it again.",
    };
  }
  revalidatePath(`/bookings/${parsed.data.bookingId}`);
  return { success: "Message sent." };
}

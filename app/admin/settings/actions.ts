"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { bookingPolicyInputSchema } from "@/lib/admin/settings-validation";

export type SettingsState = { error?: string; success?: string };

export async function saveBookingPolicy(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();
  const parsed = bookingPolicyInputSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    requestExpiryMinutes: formData.get("requestExpiryMinutes"),
    paymentDeadlineMinutes: formData.get("paymentDeadlineMinutes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_booking_policy", {
      p_request_expiry_minutes: parsed.data.requestExpiryMinutes,
      p_payment_deadline_minutes: parsed.data.paymentDeadlineMinutes,
      p_enabled: parsed.data.enabled,
    });
    if (error?.code === "22023") return { error: error.message };
    if (error) return { error: "The booking settings could not be saved. Reload and try again." };
  } catch {
    return { error: "We could not connect. Please try again shortly." };
  }
  revalidatePath("/admin/settings");
  revalidatePath("/discover");
  revalidatePath("/experiences", "layout");
  return {
    success: parsed.data.enabled
      ? "Booking requests are enabled with your chosen deadlines."
      : "New booking requests are disabled. Existing bookings keep their deadlines.",
  };
}

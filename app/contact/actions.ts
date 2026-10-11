"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { SupportState } from "@/lib/support/types";

export async function createSupportRequest(
  _state: SupportState,
  formData: FormData,
): Promise<SupportState> {
  await requireUser("/contact");
  const parsed = z
    .object({
      subject: z.string().trim().min(3, "Add a short subject.").max(120),
      message: z
        .string()
        .trim()
        .min(20, "Tell us a little more (at least 20 characters).")
        .max(3000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_support_request", {
      p_subject: parsed.data.subject,
      p_message: parsed.data.message,
    });
    if (error)
      return {
        error:
          "Your request could not be saved. Please try again later; requests are limited to ten per day.",
      };
  } catch {
    return { error: "We could not connect. Your request has not been saved." };
  }
  revalidatePath("/contact");
  revalidatePath("/admin/support");
  return {
    success: "Your request is saved. You can read Qualia's response below when it is ready.",
  };
}

export async function respondToSupport(
  _state: SupportState,
  formData: FormData,
): Promise<SupportState> {
  await requireAdmin();
  const parsed = z
    .object({ id: z.uuid(), response: z.string().trim().min(3).max(5000) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Add a response of 3–5,000 characters." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("respond_support_request", {
      p_request_id: parsed.data.id,
      p_response: parsed.data.response,
      p_close: formData.get("close") === "on",
    });
    if (error)
      return { error: "The response could not be saved. Reload this request and try again." };
  } catch {
    return { error: "We could not connect. Please try again." };
  }
  revalidatePath("/admin/support");
  revalidatePath("/contact");
  return { success: "The response is visible in this member's support history." };
}

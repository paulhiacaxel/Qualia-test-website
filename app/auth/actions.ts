"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { authIsConfigured, getSiteUrl, getSupabaseConfig } from "@/lib/supabase/config";
import { requireUser } from "@/lib/auth/session";
import {
  emailSchema,
  loginSchema,
  passwordSchema,
  safeNext,
  signupSchema,
} from "@/lib/auth/validation";
import type { AuthState } from "@/lib/auth/types";

const unavailable = { error: "Account access is not available yet. Please try again later." };
const temporary = { error: "We could not connect right now. Please try again in a moment." };

export async function signIn(_previous: AuthState, formData: FormData): Promise<AuthState> {
  if (!authIsConfigured()) return unavailable;
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error)
      return {
        error: "We could not sign you in. Check your email, password, and confirmation email.",
      };
  } catch {
    return temporary;
  }
  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_previous: AuthState, formData: FormData): Promise<AuthState> {
  if (!authIsConfigured()) return unavailable;
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, fullName, role } = parsed.data;
  const next = role === "host" ? "/host/start" : "/account/dashboard";
  let hasSession = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      if (error.code === "weak_password")
        return { error: "Choose a stronger password with at least 12 characters." };
      if (error.status === 429) return { error: "Please wait a little before trying again." };
      return {
        error:
          "We could not create your account. Try signing in or resetting your password if you already have one.",
      };
    }
    hasSession = Boolean(data.session);
  } catch {
    return temporary;
  }
  revalidatePath("/", "layout");
  redirect(hasSession ? next : `/verify-email?next=${encodeURIComponent(next)}`);
}

export async function requestPasswordReset(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!authIsConfigured()) return unavailable;
  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent("/account/update-password")}`,
    });
    if (error)
      return { error: "We could not send the request. Please wait a moment and try again." };
  } catch {
    return temporary;
  }
  // The same message is used for existing and nonexistent accounts.
  return {
    success:
      "If there is an account for that email, a password reset link is on its way. Check your inbox and spam folder.",
  };
}

export async function resendConfirmation(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!authIsConfigured()) return unavailable;
  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: parsed.data.email,
      options: {
        emailRedirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(safeNext(formData.get("next")))}`,
      },
    });
    if (error?.status === 429)
      return { error: "Please wait a little before requesting another email." };
    // Do not reveal whether the submitted address is registered or confirmed.
  } catch {
    return temporary;
  }
  return {
    success:
      "If your account needs confirmation, we have requested a new link. Please check your inbox.",
  };
}

export async function updatePassword(_previous: AuthState, formData: FormData): Promise<AuthState> {
  await requireUser("/account/update-password");
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error)
      return {
        error:
          "We could not update your password. Try a different password or request a new reset link.",
      };
    // Require a fresh sign-in after a successful change on this browser.
    const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
    if (signOutError)
      return {
        success: "Your password was changed. Please sign out and sign in with your new password.",
      };
  } catch {
    return temporary;
  }
  revalidatePath("/", "layout");
  redirect("/login?updated=1");
}

export async function signOut(): Promise<void> {
  if (getSupabaseConfig()) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch {
      throw new Error("Sign-out could not be completed. Please try again.");
    }
  }
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function enableHost(_previous: AuthState, _formData: FormData): Promise<AuthState> {
  await requireUser("/host/start");
  try {
    const supabase = await createClient();
    // This only enables a workspace. It never approves a listing or grants admin.
    const { error } = await supabase.rpc("enable_host_mode");
    if (error) return { error: "We could not open your host workspace. Please try again." };
  } catch {
    return temporary;
  }
  revalidatePath("/", "layout");
  redirect("/host/dashboard");
}

export async function confirmEmail(_previous: AuthState, formData: FormData): Promise<AuthState> {
  if (!authIsConfigured()) return unavailable;
  const parsed = z
    .object({
      token_hash: z.string().min(10).max(512),
      type: z.enum(["signup", "recovery", "email"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "This link is incomplete. Please request a new email." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp(parsed.data);
    if (error)
      return { error: "This link has expired or was already used. Please request a new email." };
  } catch {
    return temporary;
  }
  revalidatePath("/", "layout");
  redirect(
    parsed.data.type === "recovery" ? "/account/update-password" : safeNext(formData.get("next")),
  );
}

"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  signIn,
  signUp,
  requestPasswordReset,
  resendConfirmation,
  updatePassword,
  enableHost,
  confirmEmail,
} from "@/app/auth/actions";
import type { AuthState } from "@/lib/auth/types";

type Mode = "login" | "signup" | "reset" | "resend" | "password" | "host" | "confirm";
const actions = {
  login: signIn,
  signup: signUp,
  reset: requestPasswordReset,
  resend: resendConfirmation,
  password: updatePassword,
  host: enableHost,
  confirm: confirmEmail,
};
const labels = {
  login: "Sign in",
  signup: "Create account",
  reset: "Send reset link",
  resend: "Send a new link",
  password: "Update password",
  host: "Open host workspace",
  confirm: "Confirm and continue",
};

function SubmitButton({ children, disabled }: { children: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary full-width" disabled={disabled || pending}>
      {pending ? "One moment…" : children}
    </button>
  );
}

export function AuthForm({
  mode,
  configured = true,
  next = "/account/dashboard",
  initialRole = "guest",
  returnTo,
  tokenHash,
  confirmationType,
}: {
  mode: Mode;
  configured?: boolean;
  next?: string;
  initialRole?: "guest" | "host";
  returnTo?: string;
  tokenHash?: string;
  confirmationType?: string;
}) {
  const [state, action] = useActionState<AuthState, FormData>(actions[mode], {});
  const [role, setRole] = useState(initialRole);
  const needsEmail = ["login", "signup", "reset", "resend"].includes(mode);
  const needsPassword = ["login", "signup", "password"].includes(mode);
  return (
    <div className="auth-card">
      {!configured ? (
        <p className="notice" role="status">
          Account access is opening soon. Please check back before creating an account or signing
          in.
        </p>
      ) : null}
      <form
        action={action}
        className="form-stack"
        aria-describedby={state.error ? "form-error" : undefined}
      >
        <input type="hidden" name="next" value={next} />
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
        {mode === "confirm" ? (
          <>
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={confirmationType} />
          </>
        ) : null}
        <fieldset disabled={!configured} className="form-stack unstyled-fieldset">
          {mode === "signup" ? (
            <>
              <fieldset className="unstyled-fieldset">
                <legend className="field-label">I want to…</legend>
                <div className="role-options">
                  <label className={`radio-card ${role === "guest" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="role"
                      value="guest"
                      checked={role === "guest"}
                      onChange={() => setRole("guest")}
                    />
                    <span>
                      <strong>Book experiences</strong>
                      <small>Learn something new</small>
                    </span>
                  </label>
                  <label className={`radio-card ${role === "host" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="role"
                      value="host"
                      checked={role === "host"}
                      onChange={() => setRole("host")}
                    />
                    <span>
                      <strong>Host experiences</strong>
                      <small>Share your own skill</small>
                    </span>
                  </label>
                </div>
              </fieldset>
              <div>
                <label htmlFor="full-name" className="field-label">
                  Full name
                </label>
                <input
                  id="full-name"
                  name="fullName"
                  className="field-input"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>
            </>
          ) : null}
          {needsEmail ? (
            <div>
              <label htmlFor="email" className="field-label">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="field-input"
                placeholder="you@example.com"
                autoComplete="email"
                required
                maxLength={254}
              />
            </div>
          ) : null}
          {needsPassword ? (
            <div>
              <label htmlFor="password" className="field-label">
                {mode === "password" ? "New password" : "Password"}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="field-input"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "login" ? 1 : 12}
                maxLength={128}
                required
                aria-describedby={mode !== "login" ? "password-hint" : undefined}
              />
              {mode !== "login" ? (
                <p className="field-hint" id="password-hint">
                  Use at least 12 characters. A unique passphrase works well.
                </p>
              ) : null}
            </div>
          ) : null}
          {mode === "password" ? (
            <div>
              <label htmlFor="confirm-password" className="field-label">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                className="field-input"
                autoComplete="new-password"
                required
                maxLength={128}
              />
            </div>
          ) : null}
          {mode === "host" ? (
            <p className="muted">
              You can host and book with the same account. Every listing will need review before it
              appears on Qualia.
            </p>
          ) : null}
          {mode === "confirm" ? (
            <p className="muted">Continue to securely finish verifying your email link.</p>
          ) : null}
          {state.error ? (
            <p id="form-error" className="form-error" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="notice success" role="status">
              {state.success}
            </p>
          ) : null}
          <SubmitButton disabled={!configured}>
            {mode === "signup" ? `Create ${role} account` : labels[mode]}
          </SubmitButton>
        </fieldset>
        {mode === "login" ? (
          <Link className="form-link" href="/forgot-password">
            Forgot your password?
          </Link>
        ) : null}
      </form>
    </div>
  );
}

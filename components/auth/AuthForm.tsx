"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, signup, type AuthState } from "@/app/(auth)/actions";

const initial: AuthState = {};

export function AuthForm({
  mode,
  next
}: {
  mode: "login" | "signup";
  next?: string;
}) {
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="auth-card">
      <p className="eyebrow">JustLDRthings ♡</p>
      <h2 className="auth-title">
        {mode === "login" ? "Welcome back." : "Make something for them."}
      </h2>

      {next ? <input type="hidden" name="next" value={next} /> : null}

      {mode === "signup" ? (
        <div className="field">
          <label htmlFor="display_name">Your name</label>
          <input id="display_name" name="display_name" autoComplete="name" placeholder="What they call you" />
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@email.com" />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
        />
      </div>

      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p className="form-notice" role="status">
          {state.notice}
        </p>
      ) : null}

      <button type="submit" className="button button-plum auth-submit" disabled={pending}>
        {pending ? "One moment…" : mode === "login" ? "Log in" : "Create account"}
      </button>

      <p className="auth-switch">
        {mode === "login" ? (
          <>
            New here? <Link href="/signup">Make an account →</Link>
          </>
        ) : (
          <>
            Already have one? <Link href="/login">Log in →</Link>
          </>
        )}
      </p>
    </form>
  );
}

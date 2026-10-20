"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { logIn } from "./actions";

const inputBox =
  "flex h-12 w-full items-center gap-2 rounded-md border border-border-input bg-surface px-4 " +
  "focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus";

export function LoginForm() {
  const [state, action, pending] = useActionState(logIn, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const hasError = Boolean(state?.error);

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-4">
        {hasError && (
          <p
            id="login-error"
            role="alert"
            className="flex items-start gap-2 rounded-md bg-danger-tint px-4 py-3 text-small text-danger"
          >
            <CircleAlert aria-hidden size={20} className="mt-0.5 shrink-0" />
            {state?.error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-small font-medium">
            Email address
          </label>
          <div className={inputBox}>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={state?.email}
              aria-invalid={hasError || undefined}
              aria-describedby={hasError ? "login-error" : undefined}
              className="min-w-0 flex-1 bg-transparent text-body outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-small font-medium">
            Password
          </label>
          <div className={inputBox}>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              aria-invalid={hasError || undefined}
              aria-describedby={hasError ? "login-error" : undefined}
              className="min-w-0 flex-1 bg-transparent text-body outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="-mr-2 flex size-9 items-center justify-center rounded-sm text-ink-muted hover:text-ink focus-visible:outline-3 focus-visible:outline-focus"
            >
              {showPassword ? <EyeOff aria-hidden size={20} /> : <Eye aria-hidden size={20} />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            href="/owner/forgot-password"
            className="rounded-md px-2 py-3 font-semibold text-primary hover:text-primary-hover hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex min-w-30 items-center justify-center rounded-md bg-primary px-5 py-3 font-semibold text-ink-on-primary hover:bg-primary-hover focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus disabled:bg-disabled-bg disabled:text-disabled-ink"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}

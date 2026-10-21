"use client";

// The account forms (Figma 3.1–3.5). Each posts to a server action and shows its errors.
import { useActionState } from "react";
import Link from "next/link";
import { Alert } from "@/components/alert";
import { TextField } from "@/components/form-field";
import { PasswordField } from "@/components/password-field";
import { buttonClass } from "@/components/ui";
import { logIn, requestPasswordReset, setNewPassword, signUp, type FormState } from "./actions";

const hidden = (fields: Record<string, string | undefined>) =>
  Object.entries(fields).map(([name, value]) => value && <input key={name} type="hidden" name={name} value={value} />);

export function LoginForm({ next, hold, links }: { next?: string; hold?: string; links: { forgot: string; signup: string } }) {
  const [state, action, pending] = useActionState<FormState | undefined, FormData>(logIn, undefined);
  const e = state?.errors ?? {};
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {hidden({ next, hold })}
      {e.form && <Alert variant="danger" role="alert">{e.form}</Alert>}
      <TextField id="email" label="Email address" type="email" autoComplete="email" inputMode="email"
        defaultValue={state?.values?.email} error={e.email} required />
      <PasswordField id="password" label="Password" autoComplete="current-password" error={e.password} />
      <Link href={links.forgot} className={`${buttonClass.ghost} self-end`}>Forgot password?</Link>
      <button type="submit" className={`${buttonClass.primary} mt-2 w-full`} disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </button>
      <p className="flex items-center gap-1 text-small text-ink-muted">
        New here? <Link href={links.signup} className={buttonClass.ghost}>Create an account</Link>
      </p>
    </form>
  );
}

export function SignupForm({ next, hold, loginHref }: { next?: string; hold?: string; loginHref: string }) {
  const [state, action, pending] = useActionState<FormState | undefined, FormData>(signUp, undefined);
  const e = state?.errors ?? {};
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {hidden({ next, hold })}
      {e.form && <Alert variant="danger" role="alert">{e.form}</Alert>}
      <TextField id="name" label="Full name" autoComplete="name" defaultValue={state?.values?.name} error={e.name} required />
      <TextField id="email" label="Email address" type="email" autoComplete="email" inputMode="email"
        defaultValue={state?.values?.email} error={e.email} required />
      <PasswordField id="password" label="Password" autoComplete="new-password" helper="At least 8 characters" error={e.password} />
      <button type="submit" className={`${buttonClass.primary} mt-2 w-full`} disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </button>
      <p className="flex items-center gap-1 text-small text-ink-muted">
        Have an account? <Link href={loginHref} className={buttonClass.ghost}>Log in</Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState | undefined, FormData>(requestPasswordReset, undefined);
  if (state?.sentTo) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1">Check your email</h1>
          <p className="text-ink-muted">
            If there’s an account for {state.sentTo}, we’ve sent a reset link to it. The link expires in 1 hour.
          </p>
        </div>
        <Link href="/login" className={`${buttonClass.secondary} w-full`}>Back to log in</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1">Reset your password</h1>
        <p className="text-ink-muted">
          Enter the email you signed up with. We’ll send a link to set a new password. The link works for 1 hour.
        </p>
      </div>
      <form action={action} noValidate className="flex flex-col gap-6">
        <TextField id="email" label="Email address" type="email" autoComplete="email" inputMode="email"
          defaultValue={state?.values?.email} error={state?.errors?.email} required />
        <button type="submit" className={`${buttonClass.primary} w-full`} disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </div>
  );
}

export function NewPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState | undefined, FormData>(setNewPassword.bind(null, token), undefined);
  const e = state?.errors ?? {};
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <PasswordField id="password" label="New password" autoComplete="new-password" helper="At least 8 characters" error={e.password} />
      <PasswordField id="confirm" label="Confirm new password" autoComplete="new-password" error={e.confirm} />
      <button type="submit" className={`${buttonClass.primary} mt-2 w-full`} disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}

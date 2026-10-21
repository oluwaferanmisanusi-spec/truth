"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthCard } from "@/components/owner/auth-card";
import { TextField } from "@/components/form-field";
import { buttonClass } from "@/components/ui";
import { requestPasswordReset } from "./actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  if (state?.sentTo) {
    return (
      <AuthCard
        title="Check your email"
        description={`If there’s an account for ${state.sentTo}, we’ve sent a reset link to it. The link expires in 1 hour.`}
      >
        <Link href="/owner/login" className={`${buttonClass.ghost} self-center`}>
          Back to log in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter the email you signed up with. We’ll send a link to set a new password. The link works for 1 hour."
    >
      <form action={action} noValidate className="flex flex-col gap-6">
        <TextField id="email" label="Email address" type="email" autoComplete="email" required
          defaultValue={state?.email} error={state?.error} key={state?.email ?? ""} />
        <button type="submit" className={buttonClass.primary} disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <Link href="/owner/login" className={`${buttonClass.ghost} self-center`}>
        Back to log in
      </Link>
    </AuthCard>
  );
}

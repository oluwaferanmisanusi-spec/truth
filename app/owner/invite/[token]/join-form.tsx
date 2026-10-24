"use client";

import { useActionState } from "react";
import { TextField } from "@/components/form-field";
import { PasswordField } from "@/components/password-field";
import { buttonClass } from "@/components/ui";
import { acceptManagerInvite, type JoinState } from "./actions";

export function JoinForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(acceptManagerInvite.bind(null, token), undefined);
  const e = state?.errors ?? {};
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <TextField id="name" label="Full name" autoComplete="name" defaultValue={state?.values?.name} error={e.name} required />
      <TextField id="email" label="Email address" type="email" value={email} disabled readOnly
        helper="This is the email the owner invited" />
      <PasswordField id="password" label="Password" autoComplete="new-password" helper="At least 8 characters" error={e.password} />
      <button type="submit" className={`${buttonClass.primary} mt-2 w-full`} disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </button>
    </form>
  );
}

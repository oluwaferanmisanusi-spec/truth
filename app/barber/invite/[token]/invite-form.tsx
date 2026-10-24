"use client";

// "Create account" on the invite (Figma 4.1).
import { useActionState } from "react";
import { Alert } from "@/components/alert";
import { TextField } from "@/components/form-field";
import { PasswordField } from "@/components/password-field";
import { buttonClass } from "@/components/ui";
import { acceptInvite, type InviteState } from "../../actions";

export function InviteForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<InviteState | undefined, FormData>(
    acceptInvite.bind(null, token),
    undefined,
  );
  const e = state?.errors ?? {};
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {e.form && <Alert variant="danger" role="alert">{e.form}</Alert>}
      <TextField id="name" label="Full name" autoComplete="name" defaultValue={state?.values?.name} error={e.name} required />
      <TextField id="email" label="Email address" type="email" value={email} disabled readOnly
        helper="This is the email the shop invited" />
      <PasswordField id="password" label="Password" autoComplete="new-password" helper="At least 8 characters" error={e.password} />
      <button type="submit" className={`${buttonClass.primary} mt-2 w-full`} disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </button>
    </form>
  );
}

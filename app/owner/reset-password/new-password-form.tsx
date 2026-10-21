"use client";

import { useActionState } from "react";
import { Alert } from "@/components/alert";
import { TextField } from "@/components/form-field";
import { buttonClass } from "@/components/ui";
import { setNewPassword } from "./actions";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(setNewPassword, undefined);
  const errors = state?.errors ?? {};

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {errors.form && <Alert variant="warning" role="alert">{errors.form}</Alert>}
      <div className="flex flex-col gap-4">
        <TextField id="password" label="New password" type="password" autoComplete="new-password"
          helper="At least 8 characters" error={errors.password} required />
        <TextField id="confirm" label="Confirm new password" type="password" autoComplete="new-password"
          error={errors.confirm} required />
      </div>
      <button type="submit" className={buttonClass.primary} disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}

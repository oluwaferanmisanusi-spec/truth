"use client";

import { useActionState } from "react";
import { TextField } from "@/components/form-field";
import { RememberDevice } from "@/components/owner/remember-device";
import { buttonClass } from "@/components/ui";
import { logOut } from "@/app/owner/login/actions";
import { verifyCode } from "./actions";

const linkButton =
  "self-start rounded-md py-1 font-semibold text-primary hover:text-primary-hover hover:underline " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function CodeForm() {
  const [state, action, pending] = useActionState(verifyCode, undefined);

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-6" noValidate>
        <TextField id="code" name="code" label="6-digit code" inputMode="numeric" autoComplete="one-time-code"
          maxLength={7} error={state?.error} autoFocus />
        <RememberDevice />
        <button type="submit" className={buttonClass.primary} disabled={pending}>
          {pending ? "Checking…" : "Continue"}
        </button>
      </form>
      {/* No backup codes (decided 2026-10-26): someone resets it, then they set up the new phone. */}
      <div className="flex flex-col gap-1 text-small text-ink-muted">
        <p className="font-medium text-ink">Lost your phone?</p>
        <p>Managers: ask the shop owner to reset your two-step login on the Managers page.</p>
        <p>Shop owner: contact your developer to reset it.</p>
        <p>Then log in again and set it up on your new phone.</p>
      </div>
      <form action={logOut} className="border-t border-border pt-4">
        <button type="submit" className={linkButton}>Log out</button>
      </form>
    </div>
  );
}

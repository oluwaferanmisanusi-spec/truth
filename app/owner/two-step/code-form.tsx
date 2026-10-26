"use client";

import { useActionState, useState } from "react";
import { TextField } from "@/components/form-field";
import { RememberDevice } from "@/components/owner/remember-device";
import { buttonClass } from "@/components/ui";
import { logOut } from "@/app/owner/login/actions";
import { recoverWithBackupCode, verifyCode } from "./actions";

const linkButton =
  "self-start rounded-md py-1 font-semibold text-primary hover:text-primary-hover hover:underline " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function CodeForm() {
  const [useBackup, setUseBackup] = useState(false);
  const [codeState, codeAction, codePending] = useActionState(verifyCode, undefined);
  const [backupState, backupAction, backupPending] = useActionState(recoverWithBackupCode, undefined);

  return (
    <div className="flex flex-col gap-6">
      {/* Keys keep the two forms apart: otherwise the switch button's click lands on the other form's submit. */}
      {useBackup ? (
        <form key="backup" action={backupAction} className="flex flex-col gap-6" noValidate>
          <p className="text-ink-muted">
            Lost your phone? Enter one of the backup codes you saved when you set up two-step login. Each code works
            once. Then you’ll set up the app on your new phone.
          </p>
          <TextField id="backup" name="backup" label="Backup code" autoComplete="off" spellCheck={false}
            placeholder="XXXXX-XXXXX" error={backupState?.error} autoFocus />
          <button type="submit" className={buttonClass.primary} disabled={backupPending}>
            {backupPending ? "Checking…" : "Use backup code"}
          </button>
          <button type="button" className={linkButton} onClick={() => setUseBackup(false)}>
            Use the code from my app instead
          </button>
        </form>
      ) : (
        <form key="code" action={codeAction} className="flex flex-col gap-6" noValidate>
          <TextField id="code" name="code" label="6-digit code" inputMode="numeric" autoComplete="one-time-code"
            maxLength={7} error={codeState?.error} autoFocus />
          <RememberDevice />
          <button type="submit" className={buttonClass.primary} disabled={codePending}>
            {codePending ? "Checking…" : "Continue"}
          </button>
          <button type="button" className={linkButton} onClick={() => setUseBackup(true)}>
            Lost your phone? Use a backup code
          </button>
        </form>
      )}
      <form action={logOut} className="border-t border-border pt-4">
        <button type="submit" className={linkButton}>Log out</button>
      </form>
    </div>
  );
}

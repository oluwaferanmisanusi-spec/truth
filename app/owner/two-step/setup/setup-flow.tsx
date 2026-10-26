"use client";

// Set up the authenticator app: a QR code (or a key to type), then its first code.
import { useActionState, useLayoutEffect, useState, useTransition } from "react";
import { Alert } from "@/components/alert";
import { TextField } from "@/components/form-field";
import { AuthCard } from "@/components/owner/auth-card";
import { RememberDevice } from "@/components/owner/remember-device";
import { buttonClass } from "@/components/ui";
import { logOut } from "@/app/owner/login/actions";
import { finishSetup, startSetup, type CodeState, type Setup } from "../actions";

const linkButton =
  "self-start rounded-md py-1 font-semibold text-primary hover:text-primary-hover hover:underline " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function SetupFlow() {
  const [setup, setSetup] = useState<Setup>();
  const [starting, startTransition] = useTransition();
  const [state, finishAction, finishing] = useActionState(
    (prev: CodeState, fd: FormData) => finishSetup(setup?.factorId ?? "", prev, fd),
    undefined,
  );

  // Leaving the page keeps it alive but hidden (Next's Activity); forget the QR code then, so
  // it never shows again after a log out, or to whoever logs in next on this computer.
  useLayoutEffect(() => () => setSetup(undefined), []);

  if (setup?.factorId) {
    return (
      <AuthCard title="Scan this QR code" description="In your authenticator app, add an account, then scan the code.">
        {/* eslint-disable-next-line @next/next/no-img-element -- a generated QR code, not a site image */}
        <img src={setup.qr} alt="QR code to add Truth to your authenticator app" width={176} height={176}
          className="self-center rounded-md border border-border bg-surface p-2" />
        <div className="flex flex-col gap-1 text-small text-ink-muted">
          <p>Can’t scan it? Choose to enter a setup key in the app, and type:</p>
          <p className="font-mono text-body tracking-wider break-all text-ink">{setup.secret?.match(/.{1,4}/g)?.join(" ")}</p>
        </div>
        <form action={finishAction} className="flex flex-col gap-6" noValidate>
          <TextField id="code" name="code" label="Then enter the 6-digit code the app shows" inputMode="numeric"
            autoComplete="one-time-code" maxLength={7} error={state?.error} autoFocus />
          <RememberDevice />
          <button type="submit" className={buttonClass.primary} disabled={finishing}>
            {finishing ? "Checking…" : "Turn on two-step login"}
          </button>
        </form>
        <form action={logOut} className="border-t border-border pt-4">
          <button type="submit" className={linkButton}>Log out</button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set up two-step login"
      description="To keep the shop’s dashboard safe, you’ll enter a code from an app on your phone when you log in on a new device, as well as your password.">
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-ink">
        <li>Install a free authenticator app on your phone, such as Google Authenticator or Microsoft Authenticator.</li>
        <li>Continue, then scan the QR code with it.</li>
      </ol>
      {setup?.error && <Alert variant="danger" role="alert">{setup.error}</Alert>}
      <button type="button" className={buttonClass.primary} disabled={starting}
        onClick={() => startTransition(async () => setSetup(await startSetup()))}>
        {starting ? "Starting…" : "Continue"}
      </button>
      <form action={logOut} className="border-t border-border pt-4">
        <button type="submit" className={linkButton}>Log out</button>
      </form>
    </AuthCard>
  );
}

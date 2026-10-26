"use client";

// Set up the authenticator app (QR code or typed key, then its first code), then show the
// backup codes once.
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Alert } from "@/components/alert";
import { TextField } from "@/components/form-field";
import { AuthCard } from "@/components/owner/auth-card";
import { buttonClass } from "@/components/ui";
import { logOut } from "@/app/owner/login/actions";
import { finishSetup, startSetup, type Setup } from "../actions";

const linkButton =
  "self-start rounded-md py-1 font-semibold text-primary hover:text-primary-hover hover:underline " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function SetupFlow({ alreadyOn, recovered }: { alreadyOn: boolean; recovered?: number }) {
  const [setup, setSetup] = useState<Setup>();
  const [starting, startTransition] = useTransition();
  const [done, finishAction, finishing] = useActionState(
    (prev: Awaited<ReturnType<typeof finishSetup>> | undefined, fd: FormData) => finishSetup(setup?.factorId ?? "", prev, fd),
    undefined,
  );

  if (done?.codes) return <BackupCodes codes={done.codes} />;

  if (alreadyOn) {
    return (
      <AuthCard title="Two-step login is on" description="You’ve already set up your authenticator app.">
        <Link href="/owner/bookings" className={buttonClass.primary}>Go to the dashboard</Link>
      </AuthCard>
    );
  }

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
            autoComplete="one-time-code" maxLength={7} error={done?.error} autoFocus />
          <button type="submit" className={buttonClass.primary} disabled={finishing}>
            {finishing ? "Checking…" : "Turn on two-step login"}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set up two-step login"
      description="To keep the shop’s dashboard safe, you’ll enter a code from an app on your phone each time you log in, as well as your password.">
      {recovered !== undefined && (
        <Alert title="Backup code accepted">
          Your old phone no longer works for Truth. Set up the app on your new phone, and you’ll get a new set of
          backup codes.
        </Alert>
      )}
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

function BackupCodes({ codes }: { codes: string[] }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = `Truth backup codes. Each code works once.\n\n${codes.join("\n")}\n`;
  const download = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;

  return (
    <AuthCard title="Save your backup codes"
      description="If you lose your phone, each code lets you log in once. Keep them somewhere safe, such as a password manager. You won’t see them again.">
      <Alert>Two-step login is on.</Alert>
      <ol className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border border-border bg-surface-muted px-5 py-4 font-mono text-body text-ink">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ol>
      <div className="flex gap-3">
        <button type="button" className={buttonClass.secondary}
          onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => {})}>
          {copied ? "Copied" : "Copy codes"}
        </button>
        <a href={download} download="truth-backup-codes.txt" className={buttonClass.secondary}>Download</a>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-ink">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)}
          className="size-5 shrink-0 cursor-pointer accent-primary" />
        I’ve saved my backup codes
      </label>
      {saved ? (
        <Link href="/owner/bookings" className={buttonClass.primary}>Go to the dashboard</Link>
      ) : (
        <button type="button" className={buttonClass.primary} disabled>Go to the dashboard</button>
      )}
    </AuthCard>
  );
}

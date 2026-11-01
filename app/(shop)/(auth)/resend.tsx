"use client";

// "Resend link" / "Send a new link" with the "New link sent" banner (Figma 3.21b, 3.22, 3.23b).
import { useActionState, type ReactNode } from "react";
import { Alert } from "@/components/alert";
import { Toast } from "@/components/toast";
import { buttonClass } from "@/components/ui";
import type { FormState } from "./actions";

type Props = {
  action: () => Promise<FormState>;
  label: string;
  primary?: boolean;
  /** Follows "Check <email>." under "New link sent". */
  sentNote: string;
  children?: ReactNode;
};

export function ResendPanel({ action, label, primary = false, sentNote, children }: Props) {
  const [state, run, pending] = useActionState<FormState | undefined, FormData>(() => action(), undefined);
  return (
    <div className="flex flex-col gap-6">
      {state?.sentTo && !state.tooSoon && (
        <Toast variant="success" title="New link sent" trigger={state}>Check {state.sentTo}. {sentNote}</Toast>
      )}
      {state?.tooSoon && (
        <Toast variant="info" title="We just sent one" trigger={state}>
          Check {state.sentTo}, including your spam folder. You can ask again in a minute.
        </Toast>
      )}
      {children}
      <form action={run} className="flex flex-col">
        <button type="submit" className={primary ? `${buttonClass.primary} w-full` : buttonClass.ghost} disabled={pending}>
          {pending ? "Sending…" : label}
        </button>
      </form>
    </div>
  );
}

/** My bookings banner for unverified accounts (Figma 3.23 → 3.23b after "Resend link"). */
export function VerifyBanner({ email, action }: { email: string; action: () => Promise<FormState> }) {
  const [state, run, pending] = useActionState<FormState | undefined, FormData>(() => action(), undefined);
  return (
    <>
      {state?.sentTo && (
        <Toast variant="success" title={state.tooSoon ? "We just sent one" : "New link sent"} trigger={state}>
          Check {state.sentTo}. Bookings you made as a guest will appear here once you verify.
        </Toast>
      )}
      <Alert variant="info" title="Verify your email">
        <p>We sent a link to {email}. Bookings you made as a guest will appear here once you verify.</p>
        <form action={run}>
          <button type="submit" className={`${buttonClass.ghost} -ml-2`} disabled={pending}>
            {pending ? "Sending…" : "Resend link"}
          </button>
        </form>
      </Alert>
    </>
  );
}

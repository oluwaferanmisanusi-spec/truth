"use client";

// Figma 5.10 Status card, 5.11 Has bookings, 5.11b Deactivate confirm.
import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert } from "@/components/alert";
import { Dialog } from "@/components/dialog";
import { RecordStatusBadge } from "@/components/status-badge";
import { buttonClass } from "@/components/ui";
import { resendInvite, setBarberActive } from "../actions";

export function BarberStatusCard({ id, firstName, status, upcoming, bookingsHref, inviteExpiry }: {
  id: string;
  firstName: string;
  status: "active" | "inactive" | "invited";
  upcoming: number;
  bookingsHref: string;
  inviteExpiry?: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  const run = <R extends { error?: string } | undefined>(fn: () => Promise<R>, okText?: string | ((result: R) => string)) =>
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setMessage({ ok: false, text: result.error });
      else {
        setOpen(false);
        if (okText) setMessage({ ok: true, text: typeof okText === "function" ? okText(result) : okText });
      }
    });

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 self-start rounded-lg border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 font-semibold">Status</h2>
        <p className="text-small text-ink-muted">
          {status === "invited"
            ? `They haven’t set up their account yet.${inviteExpiry ? ` The invite expires on ${inviteExpiry}.` : " The invite has expired."}`
            : "Deactivated barbers can’t see their schedule and aren’t shown to customers. They can still book as customers, and their past bookings stay in your records."}
        </p>
      </div>
      <div><RecordStatusBadge status={status} /></div>

      {message && (
        <Alert variant={message.ok ? "success" : "warning"} role={message.ok ? "status" : "alert"}>
          {message.text}
        </Alert>
      )}

      <div>
        {status === "active" && (
          <button type="button" className={buttonClass.secondary} onClick={() => setOpen(true)}>
            Deactivate barber
          </button>
        )}
        {status === "inactive" && (
          <button type="button" className={buttonClass.secondary} disabled={pending}
            onClick={() => run(() => setBarberActive(id, true), `${firstName} is active again and can be booked.`)}>
            {pending ? "Reactivating…" : "Reactivate barber"}
          </button>
        )}
        {status === "invited" && (
          <button type="button" className={buttonClass.secondary} disabled={pending}
            onClick={() =>
              run(
                () => resendInvite(id),
                (r) =>
                  r?.emailed
                    ? `Invite resent to ${r.email}. The old link no longer works.`
                    : "Invite resent, but the email didn’t go out. Copy the new link from the Barbers list and send it yourself.",
              )
            }>
            {pending ? "Resending…" : "Resend invite"}
          </button>
        )}
      </div>

      {upcoming > 0 ? (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title={`${firstName} has ${upcoming} upcoming booking${upcoming === 1 ? "" : "s"}`}
          actions={
            <>
              <button type="button" className={buttonClass.secondary} onClick={() => setOpen(false)}>Close</button>
              <Link href={bookingsHref} className={buttonClass.primary}>View {firstName}’s bookings</Link>
            </>
          }
        >
          <p>
            Before you deactivate {firstName}, cancel {upcoming === 1 ? "this booking" : "these bookings"}. Each
            customer gets a full refund and an email.
          </p>
        </Dialog>
      ) : (
        <Dialog
          open={open}
          onClose={() => !pending && setOpen(false)}
          title={`Deactivate ${firstName}?`}
          actions={
            <>
              <button type="button" className={buttonClass.secondary} onClick={() => setOpen(false)} disabled={pending}>Cancel</button>
              <button type="button" className={buttonClass.danger} disabled={pending} onClick={() => run(() => setBarberActive(id, false))}>
                {pending ? "Deactivating…" : `Deactivate ${firstName}`}
              </button>
            </>
          }
        >
          <p>
            {firstName} won’t be able to log in, and customers won’t be able to book {firstName}. {firstName} has no
            upcoming bookings. Past bookings stay in your records.
          </p>
          {message && !message.ok && (
            <div className="mt-4"><Alert variant="warning" role="alert">{message.text}</Alert></div>
          )}
        </Dialog>
      )}
    </div>
  );
}

"use client";

// Figma 5.8 Barbers, 5.8b Invite resent, 5.8c deactivated banner, 5.9 Invite barber.
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { CircleAlert } from "lucide-react";
import { Alert } from "@/components/alert";
import { Dialog } from "@/components/dialog";
import { TextField } from "@/components/form-field";
import { PageHeader } from "@/components/owner/page-header";
import { RecordStatusBadge } from "@/components/status-badge";
import { buttonClass } from "@/components/ui";
import { inviteBarber, resendInvite, type InviteResult } from "./actions";

type Barber = {
  id: string;
  fullName: string | null;
  email: string;
  status: "active" | "inactive" | "invited";
  initials: string;
  servicesOffered: number;
  upcoming: number;
};

type Notice =
  | { kind: "invite"; title: string; email: string; link: string; expiresAt: string; emailed: boolean }
  | { kind: "deactivated"; name: string };

const expiry = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short" }).format(new Date(iso));

export function BarbersList({ barbers, activeServiceCount, deactivatedName }: {
  barbers: Barber[];
  activeServiceCount: number;
  deactivatedName?: string;
}) {
  const [notice, setNotice] = useState<Notice | undefined>(
    deactivatedName ? { kind: "deactivated", name: deactivatedName } : undefined,
  );
  const [inviting, setInviting] = useState(false);
  const [resendError, setResendError] = useState<string>();
  const [resendingId, setResendingId] = useState<string>();
  const [, startTransition] = useTransition();

  const resend = (id: string) => {
    setResendingId(id);
    startTransition(async () => {
      const result = await resendInvite(id);
      setResendingId(undefined);
      if (result?.error || !result?.link) setResendError(result?.error);
      else {
        setResendError(undefined);
        setNotice({
          kind: "invite",
          title: "Invite resent",
          email: result.email!,
          link: result.link,
          expiresAt: result.expiresAt!,
          emailed: Boolean(result.emailed),
        });
      }
    });
  };

  return (
    <>
      <PageHeader
        title="Barbers"
        description="Who works here, which services they offer and when they work."
        action={
          <button type="button" className={buttonClass.primary} onClick={() => setInviting(true)}>
            Invite barber
          </button>
        }
      />

      {notice?.kind === "deactivated" && (
        <Alert title={`${notice.name} deactivated`}>
          {notice.name.split(" ")[0]} can’t log in and isn’t shown to customers. Past bookings stay in your records.
        </Alert>
      )}
      {notice?.kind === "invite" && <InviteNotice notice={notice} />}
      {resendError && (
        <Alert variant="warning" role="alert">
          {resendError}
        </Alert>
      )}

      <div className="flex flex-col gap-8">
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full table-fixed border-collapse text-left text-small">
            <colgroup>
              <col className="w-70" />
              <col className="w-64" />
              <col className="w-39" />
              <col className="w-39" />
              <col className="w-34" />
              <col />
            </colgroup>
            <thead className="bg-surface-muted text-caption font-medium text-ink-muted">
              <tr className="h-10 border-b border-border">
                <th scope="col" className="py-2 pr-2 pl-5 font-medium">Barber</th>
                <th scope="col" className="px-2 py-2 font-medium">Email</th>
                <th scope="col" className="px-2 py-2 font-medium">Services</th>
                <th scope="col" className="px-2 py-2 font-medium">Upcoming</th>
                <th scope="col" className="px-2 py-2 font-medium">Status</th>
                <th scope="col" className="py-2 pr-5 pl-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {barbers.map((b) => {
                const name = b.fullName ?? "Invite pending";
                return (
                  <tr key={b.id} className="h-18 border-b border-border last:border-b-0">
                    <th scope="row" className="py-3 pr-2 pl-5 font-medium">
                      <span className="flex items-center gap-3">
                        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                          {b.initials}
                        </span>
                        <span className="truncate">{name}</span>
                      </span>
                    </th>
                    <td className="truncate px-2 py-3 text-ink-muted" title={b.email}>{b.email}</td>
                    <td className="px-2 py-3">{b.servicesOffered} of {activeServiceCount}</td>
                    <td className="px-2 py-3">
                      {b.status === "invited" ? "–" : b.upcoming ? `${b.upcoming} booking${b.upcoming === 1 ? "" : "s"}` : "None"}
                    </td>
                    <td className="px-2 py-3"><RecordStatusBadge status={b.status} /></td>
                    <td className="py-3 pr-5 pl-2 text-right">
                      {b.status === "invited" ? (
                        <button type="button" className={buttonClass.ghost} onClick={() => resend(b.id)}
                          disabled={resendingId === b.id} aria-label={`Resend invite to ${b.email}`}>
                          {resendingId === b.id ? "Resending…" : "Resend"}
                        </button>
                      ) : (
                        <Link href={`/owner/barbers/${b.id}`} className={buttonClass.ghost} aria-label={`Manage ${name}`}>
                          Manage
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-caption font-medium text-ink-muted">Invites expire after 7 days. Resending sends a fresh link.</p>
      </div>

      <InviteDialog
        open={inviting}
        onClose={() => setInviting(false)}
        onSent={(r) => {
          setInviting(false);
          setNotice({
            kind: "invite",
            title: r.emailed ? `Invite sent to ${r.email}` : `Invite created for ${r.email}`,
            email: r.email!,
            link: r.link!,
            expiresAt: r.expiresAt!,
            emailed: Boolean(r.emailed),
          });
        }}
      />
    </>
  );
}

function InviteDialog({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: (r: NonNullable<InviteResult>) => void }) {
  // On success, hand the result up and clear the dialog's own state; React resets the form fields.
  const [state, action, pending] = useActionState(async (prev: InviteResult, formData: FormData) => {
    const result = await inviteBarber(prev, formData);
    if (result?.link) {
      onSent(result);
      return undefined;
    }
    return result;
  }, undefined);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite a barber"
      actions={
        <>
          <button type="button" className={buttonClass.secondary} onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" form="invite-form" className={buttonClass.primary} disabled={pending}>
            {pending ? "Sending…" : "Send invite"}
          </button>
        </>
      }
    >
      <form id="invite-form" action={action} noValidate className="flex flex-col gap-4">
        <p>We’ll email them a link to set up their account. The link expires in 7 days.</p>
        <div className="text-ink">
          <TextField id="email" label="Email address" type="email" autoComplete="off" placeholder="name@example.com"
            defaultValue={state?.email} error={state?.error} required key={state?.email ?? ""} />
        </div>
      </form>
    </Dialog>
  );
}

function InviteNotice({ notice }: { notice: Extract<Notice, { kind: "invite" }> }) {
  const [copied, setCopied] = useState(false);
  return (
    <Alert title={notice.title}>
      <p>
        The link expires on {expiry(notice.expiresAt)}. Any earlier link for {notice.email} no longer works.
      </p>
      <div className="mt-3 flex flex-col gap-2 rounded-md bg-surface p-3">
        {notice.emailed ? (
          <p className="text-ink-muted">
            We’ve emailed the link to {notice.email}. You can also copy it and send it another way.
          </p>
        ) : (
          <p className="flex items-start gap-2 text-ink-muted">
            <CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
            We couldn’t email the invite, so copy this link and send it to {notice.email} yourself.
          </p>
        )}
        <div className="flex items-center gap-3">
          <code className="min-w-0 flex-1 truncate rounded-sm bg-surface-muted px-2 py-1 text-caption">{notice.link}</code>
          <button
            type="button"
            className={buttonClass.ghost}
            onClick={async () => {
              await navigator.clipboard.writeText(notice.link);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </Alert>
  );
}

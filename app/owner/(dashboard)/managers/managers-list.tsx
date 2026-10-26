"use client";

// The Managers page: the owner, the managers, and (for the owner) open invites. Built from
// the Barbers screen's table, invite dialog and invite notice (Figma 5.8, 5.9).
import { useActionState, useState, useTransition } from "react";
import { CircleAlert } from "lucide-react";
import type { Team } from "@api/owner";
import { Alert } from "@/components/alert";
import { Dialog } from "@/components/dialog";
import { TextField } from "@/components/form-field";
import { PageHeader } from "@/components/owner/page-header";
import { buttonClass } from "@/components/ui";
import {
  cancelManagerInvite,
  inviteManager,
  removeManager,
  resendManagerInvite,
  resetManagerTwoStep,
  type InviteResult,
} from "./actions";

type Notice =
  | { kind: "invite"; title: string; email: string; link: string; expiresAt: string; emailed: boolean }
  | { kind: "done"; text: string };

const expiry = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short" }).format(new Date(iso));

const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "–";

const badge = "inline-flex rounded-full px-2 py-1 text-caption font-medium whitespace-nowrap";

export function ManagersList({ team, isOwner }: { team: Team; isOwner: boolean }) {
  const [notice, setNotice] = useState<Notice>();
  const [error, setError] = useState<string>();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string }>();
  const [resetting, setResetting] = useState<{ id: string; name: string }>();
  const [busyId, setBusyId] = useState<string>();
  const [pending, startTransition] = useTransition();

  const showInvite = (title: string, r: NonNullable<InviteResult>) =>
    setNotice({ kind: "invite", title, email: r.email!, link: r.link!, expiresAt: r.expiresAt!, emailed: Boolean(r.emailed) });

  const run = (id: string, fn: () => Promise<{ error?: string } | InviteResult>, onOk: (r: NonNullable<InviteResult>) => void) => {
    setBusyId(id);
    startTransition(async () => {
      const result = await fn();
      setBusyId(undefined);
      if (result?.error) setError(result.error);
      else {
        setError(undefined);
        onOk(result ?? {});
      }
    });
  };

  return (
    <>
      <PageHeader
        title="Managers"
        description={
          isOwner
            ? "Managers can use this dashboard like you: bookings, stats, services, barbers and shop settings. Only you can invite or remove them."
            : "Managers can use this dashboard like the owner: bookings, stats, services, barbers and shop settings. Only the shop owner can invite or remove managers."
        }
        action={
          isOwner ? (
            <button type="button" className={buttonClass.primary} onClick={() => setInviting(true)}>
              Invite manager
            </button>
          ) : undefined
        }
      />

      {notice?.kind === "invite" && <InviteNotice notice={notice} />}
      {notice?.kind === "done" && <Alert>{notice.text}</Alert>}
      {error && <Alert variant="warning" role="alert">{error}</Alert>}

      <div className="flex flex-col gap-8">
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full table-fixed border-collapse text-left text-small">
            {/* Email takes what's left (it truncates), so the actions keep their room. */}
            <colgroup>
              <col className="w-64" />
              <col />
              <col className="w-36" />
              <col className="w-36" />
              <col className="w-68" />
            </colgroup>
            <thead className="bg-surface-muted text-caption font-medium text-ink-muted">
              <tr className="h-10 border-b border-border">
                <th scope="col" className="py-2 pr-2 pl-5 font-medium">Name</th>
                <th scope="col" className="px-2 py-2 font-medium">Email</th>
                <th scope="col" className="px-2 py-2 font-medium">Role</th>
                <th scope="col" className="px-2 py-2 font-medium">Two-step login</th>
                <th scope="col" className="py-2 pr-5 pl-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <Row name={team.owner.name} email={team.owner.email}
                role={<span className={`${badge} bg-primary-tint text-primary`}>Owner</span>}
                twoStep={<TwoStepStatus on={team.owner.twoStep} />} />
              {team.managers.map((m) => (
                <Row key={m.id} name={m.isMe ? `${m.name} (you)` : m.name} email={m.email}
                  role={<span className={`${badge} bg-success-tint text-success`}>Manager</span>}
                  twoStep={<TwoStepStatus on={m.twoStep} />}
                  action={
                    isOwner && (
                      <span className="flex justify-end gap-1">
                        {m.twoStep && (
                          <button type="button" className={buttonClass.ghost} aria-label={`Reset ${m.name}’s two-step login`}
                            onClick={() => setResetting({ id: m.id, name: m.name })}>
                            Reset two-step
                          </button>
                        )}
                        <button type="button" className={buttonClass.ghost} aria-label={`Remove ${m.name}`}
                          onClick={() => setRemoving({ id: m.id, name: m.name })}>
                          Remove
                        </button>
                      </span>
                    )
                  }
                />
              ))}
              {team.invites.map((i) => (
                <Row key={i.id} name="Invite pending" email={i.email}
                  role={
                    <span className={`${badge} bg-warning-tint text-warning`}>
                      {i.expired ? "Invite expired" : `Invited, until ${expiry(i.expiresAt)}`}
                    </span>
                  }
                  action={
                    isOwner && (
                    <span className="flex justify-end gap-1">
                      <button type="button" className={buttonClass.ghost} disabled={pending && busyId === i.id}
                        aria-label={`Resend invite to ${i.email}`}
                        onClick={() => run(i.id, () => resendManagerInvite(i.id), (r) => showInvite("Invite resent", r))}>
                        {busyId === i.id ? "Working…" : "Resend"}
                      </button>
                      <button type="button" className={buttonClass.ghost} disabled={pending && busyId === i.id}
                        aria-label={`Cancel invite to ${i.email}`}
                        onClick={() => run(i.id, () => cancelManagerInvite(i.id),
                          () => setNotice({ kind: "done", text: `Invite to ${i.email} cancelled. The link no longer works.` }))}>
                        Cancel invite
                      </button>
                    </span>
                    )
                  }
                />
              ))}
            </tbody>
          </table>
          {team.managers.length === 0 && team.invites.length === 0 && (
            <p className="border-t border-border px-5 py-4 text-ink-muted">
              No managers yet.{isOwner ? " Invite someone to help you run the shop." : ""}
            </p>
          )}
        </div>
        <p className="text-caption font-medium text-ink-muted">
          Invites expire after 7 days. Only the owner can invite or remove managers, or reset a manager’s two-step
          login if they lose their phone and backup codes.
        </p>
      </div>

      <InviteDialog
        open={inviting}
        onClose={() => setInviting(false)}
        onSent={(r) => {
          setInviting(false);
          showInvite(r.emailed ? `Invite sent to ${r.email}` : `Invite created for ${r.email}`, r);
        }}
      />

      <Dialog
        open={Boolean(removing)}
        onClose={() => !pending && setRemoving(undefined)}
        title={`Remove ${removing?.name ?? "this manager"}?`}
        actions={
          <>
            <button type="button" className={buttonClass.secondary} disabled={pending} onClick={() => setRemoving(undefined)}>
              Keep manager
            </button>
            <button type="button" className={buttonClass.danger} disabled={pending}
              onClick={() =>
                removing &&
                run(removing.id, () => removeManager(removing.id), () => {
                  setNotice({ kind: "done", text: `${removing.name} has been removed and can no longer log in.` });
                  setRemoving(undefined);
                })
              }>
              {pending ? "Removing…" : "Remove manager"}
            </button>
          </>
        }
      >
        <p>
          They’ll be logged out straight away and won’t be able to use the dashboard again. To give them access later,
          send a new invite.
        </p>
      </Dialog>

      <Dialog
        open={Boolean(resetting)}
        onClose={() => !pending && setResetting(undefined)}
        title={`Reset ${resetting?.name ?? "this manager"}’s two-step login?`}
        actions={
          <>
            <button type="button" className={buttonClass.secondary} disabled={pending} onClick={() => setResetting(undefined)}>
              Cancel
            </button>
            <button type="button" className={buttonClass.danger} disabled={pending}
              onClick={() =>
                resetting &&
                run(resetting.id, () => resetManagerTwoStep(resetting.id), () => {
                  setNotice({
                    kind: "done",
                    text: `${resetting.name}’s two-step login is reset. They’ll set it up on their new phone when they next log in.`,
                  });
                  setResetting(undefined);
                })
              }>
              {pending ? "Resetting…" : "Reset two-step login"}
            </button>
          </>
        }
      >
        <p>
          Do this if they’ve lost their phone and their backup codes. Their authenticator app and backup codes stop
          working and they’re logged out. When they next log in with their password, they’ll set it up again.
        </p>
      </Dialog>
    </>
  );
}

function TwoStepStatus({ on }: { on: boolean }) {
  return on ? (
    <span className={`${badge} bg-success-tint text-success`}>On</span>
  ) : (
    <span className={`${badge} bg-surface-muted text-ink-muted`}>Not set up</span>
  );
}

function Row({ name, email, role, twoStep, action }: {
  name: string;
  email: string;
  role: React.ReactNode;
  twoStep?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <tr className="h-18 border-b border-border last:border-b-0">
      <th scope="row" className="py-3 pr-2 pl-5 font-medium">
        <span className="flex items-center gap-3">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
            {name === "Invite pending" ? "–" : initials(name)}
          </span>
          <span className="truncate">{name}</span>
        </span>
      </th>
      <td className="truncate px-2 py-3 text-ink-muted" title={email}>{email}</td>
      <td className="px-2 py-3">{role}</td>
      <td className="px-2 py-3">{twoStep ?? <span className="text-ink-muted">–</span>}</td>
      <td className="py-3 pr-5 pl-2 text-right">{action}</td>
    </tr>
  );
}

function InviteDialog({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: (r: NonNullable<InviteResult>) => void }) {
  const [state, action, pending] = useActionState(async (prev: InviteResult, formData: FormData) => {
    const result = await inviteManager(prev, formData);
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
      title="Invite a manager"
      actions={
        <>
          <button type="button" className={buttonClass.secondary} onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" form="manager-invite-form" className={buttonClass.primary} disabled={pending}>
            {pending ? "Sending…" : "Send invite"}
          </button>
        </>
      }
    >
      <form id="manager-invite-form" action={action} noValidate className="flex flex-col gap-4">
        <p>We’ll email them a link to set a password. The link expires in 7 days. Use an email they don’t already use with Truth.</p>
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
      <p>The link expires on {expiry(notice.expiresAt)}. Any earlier link for {notice.email} no longer works.</p>
      <div className="mt-3 flex flex-col gap-2 rounded-md bg-surface p-3">
        {notice.emailed ? (
          <p className="text-ink-muted">We’ve emailed the link to {notice.email}. You can also copy it and send it another way.</p>
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

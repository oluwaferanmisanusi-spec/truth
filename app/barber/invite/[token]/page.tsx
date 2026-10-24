// Barber invite link (Figma 4.1 join, 4.2 expired). Barber logins are barber-only, so the
// barber always sets a new password here; an email that already has a customer account
// can't be used (the owner invites a different one).
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import type { BarberInvite } from "@api/barber";
import { BrandBar } from "@/components/shop/bars";
import { StatusHero } from "@/components/shop/status-hero";
import { buttonClass } from "@/components/ui";
import { api } from "@/lib/api/client";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Join as a barber" };

type Props = PageProps<"/barber/invite/[token]">;
const TOKEN = /^[\w-]{20,100}$/;

export default function InvitePage({ params }: Props) {
  return (
    <>
      <BrandBar />
      <Suspense fallback={<p className="px-4 py-6 text-ink-muted">Loading your invite…</p>}>
        <Invite params={params} />
      </Suspense>
    </>
  );
}

async function Invite({ params }: Pick<Props, "params">) {
  const { token } = await params;
  if (!TOKEN.test(token)) notFound();
  const invite = await api<BarberInvite>(`/barber-invites/${encodeURIComponent(token)}`);

  if (invite.state === "missing") notFound();
  if (invite.state === "expired") {
    return (
      <main className="px-4 pt-10 pb-6">
        <StatusHero icon={Clock} tone="warning" title="This invite has expired">
          Invites work for 7 days. Ask the shop owner to send you a new one.
        </StatusHero>
      </main>
    );
  }
  if (invite.state === "accepted") {
    return (
      <main className="flex flex-col gap-6 px-4 pt-10 pb-6">
        <StatusHero icon={CircleCheck} tone="success" title="You’ve already joined">
          This invite has been used. Log in to see your schedule.
        </StatusHero>
        <Link href="/login" className={`${buttonClass.primary} w-full`}>Log in</Link>
      </main>
    );
  }
  if (invite.hasAccount) {
    return (
      <main className="px-4 pt-10 pb-6">
        <StatusHero icon={CircleAlert} tone="warning" title="This email already has an account">
          {invite.email} is already used for a customer account. Barbers need their own email, so ask the shop owner
          to invite you with a different one.
        </StatusHero>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1">Join Truth as a barber</h1>
        <p className="text-ink-muted">
          Set a password to see your schedule and manage your time. This invite expires in 7 days.
        </p>
      </div>
      <InviteForm token={token} email={invite.email} />
    </main>
  );
}

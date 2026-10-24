import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ManagerInvite } from "@api/owner";
import { AuthCard } from "@/components/owner/auth-card";
import { buttonClass } from "@/components/ui";
import { api } from "@/lib/api/client";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join as a manager" };

const TOKEN = /^[\w-]{20,100}$/;

// The link in a manager's invite email (decided 2026-10-24; built from the owner log in card).
export default function ManagerInvitePage({ params }: PageProps<"/owner/invite/[token]">) {
  return (
    <Suspense fallback={<AuthCard title="Join Truth as a manager" description="Loading your invite…" />}>
      <Invite params={params} />
    </Suspense>
  );
}

async function Invite({ params }: { params: PageProps<"/owner/invite/[token]">["params"] }) {
  const { token } = await params;
  if (!TOKEN.test(token)) notFound();
  const invite = await api<ManagerInvite>(`/manager-invites/${encodeURIComponent(token)}`);

  if (invite.state === "missing") notFound();
  if (invite.state === "expired") {
    return (
      <AuthCard title="This invite has expired"
        description="Invites work for 7 days. Ask the shop owner to send you a new one." />
    );
  }
  if (invite.state === "accepted") {
    return (
      <AuthCard title="You’ve already joined" description="This invite has been used. Log in to manage the shop.">
        <Link href="/owner/login" className={`${buttonClass.primary} w-full`}>Log in</Link>
      </AuthCard>
    );
  }
  if (invite.hasAccount) {
    return (
      <AuthCard title="This email already has an account"
        description={`${invite.email} is already used with Truth. Managers need their own email, so ask the shop owner to invite a different one.`} />
    );
  }
  return (
    <AuthCard title="Join Truth as a manager"
      description="Set a password to help manage the shop: bookings, stats, services, barbers and settings. This invite expires in 7 days.">
      <JoinForm token={token} email={invite.email} />
    </AuthCard>
  );
}

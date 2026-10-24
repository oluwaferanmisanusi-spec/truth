// Barber invite link (Figma 4.1 join, 4.2 expired). If the invited email already has an
// account (say, a regular customer), they log in and join with it instead of setting a
// password, so they keep one login for booking and for their schedule.
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, Clock } from "lucide-react";
import type { BarberInvite } from "@api/barber";
import { BrandBar } from "@/components/shop/bars";
import { LogoutButton } from "@/components/shop/logout-button";
import { StatusHero } from "@/components/shop/status-hero";
import { buttonClass } from "@/components/ui";
import { api } from "@/lib/api/client";
import { getAccount } from "@/lib/auth/customer";
import { logOut } from "@/app/(shop)/(auth)/actions";
import { joinInvite } from "../../actions";
import { InviteForm, JoinButton } from "./invite-form";

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
  const [invite, account] = await Promise.all([
    api<BarberInvite>(`/barber-invites/${encodeURIComponent(token)}`),
    getAccount(),
  ]);
  const here = `/barber/invite/${token}`;

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
        <Link href={account?.barberId ? "/barber" : "/login?next=/barber"} className={`${buttonClass.primary} w-full`}>
          {account?.barberId ? "See my schedule" : "Log in"}
        </Link>
      </main>
    );
  }

  const signedInAsInvited = account?.email.toLowerCase() === invite.email.toLowerCase();
  return (
    <main className="flex flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1">Join Truth as a barber</h1>
        <p className="text-ink-muted">
          {invite.hasAccount
            ? `There’s already a Truth account for ${invite.email}. Join with it to see your schedule and manage your time. You’ll keep your bookings.`
            : "Set a password to see your schedule and manage your time. This invite expires in 7 days."}
        </p>
      </div>

      {!invite.hasAccount && !account && <InviteForm token={token} email={invite.email} />}

      {invite.hasAccount && signedInAsInvited && <JoinButton join={joinInvite.bind(null, token)} />}

      {invite.hasAccount && !account && (
        <Link href={`/login?next=${encodeURIComponent(here)}`} className={`${buttonClass.primary} w-full`}>
          Log in to join
        </Link>
      )}

      {account && !signedInAsInvited && (
        <div className="flex flex-col gap-3">
          <p className="text-ink-muted">
            You’re logged in as {account.email}. This invite is for {invite.email}, so log out first, then{" "}
            {invite.hasAccount ? "log in with that email" : "open this link again"}.
          </p>
          <div className="self-start">
            <LogoutButton action={logOut.bind(null, here)} message="You can log back in with the invited email afterwards." />
          </div>
        </div>
      )}
    </main>
  );
}

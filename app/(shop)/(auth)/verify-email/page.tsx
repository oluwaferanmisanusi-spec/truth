// Verify your email (Figma 3.21, 3.21b after "Resend link").
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { BrandBar } from "@/components/shop/bars";
import { StatusHero } from "@/components/shop/status-hero";
import { Alert } from "@/components/alert";
import { buttonClass } from "@/components/ui";
import { requireAccount } from "@/lib/auth/customer";
import { resendVerification } from "../actions";
import { ResendPanel } from "../resend";

export default function VerifyEmailPage() {
  return (
    <>
      <BrandBar />
      <main className="flex flex-col gap-3 px-4 pt-10 pb-6">
        <Suspense>
          <VerifyEmail />
        </Suspense>
      </main>
    </>
  );
}

async function VerifyEmail() {
  const account = await requireAccount("/verify-email");
  if (account.verified) redirect("/bookings");
  return (
    <>
      <ResendPanel
        action={resendVerification}
        label="Resend link"
        sentNote="If it’s not there, look in your spam folder."
      >
        <StatusHero icon={Mail} tone="primary" title="Check your email">
          We sent a link to {account.email}. Open it to finish setting up your account. The link works for 24 hours.
        </StatusHero>
        <Alert variant="info" title="Booked as a guest before?">
          Once you verify, bookings you made with this email will show up in your account.
        </Alert>
      </ResendPanel>
      <Link href="/bookings" className={`${buttonClass.ghost} self-center`}>Skip for now</Link>
    </>
  );
}

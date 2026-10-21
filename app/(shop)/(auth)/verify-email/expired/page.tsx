// Verification link expired (Figma 3.22).
import { Suspense } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { BrandBar } from "@/components/shop/bars";
import { StatusHero } from "@/components/shop/status-hero";
import { buttonClass } from "@/components/ui";
import { resendFromExpiredLink } from "../../actions";
import { ResendPanel } from "../../resend";

type Props = PageProps<"/verify-email/expired">;

export default function VerifyExpiredPage({ searchParams }: Props) {
  return (
    <>
      <BrandBar />
      <main className="flex flex-col gap-6 px-4 pt-10 pb-6">
        <Suspense>
          <Expired searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Expired({ searchParams }: Pick<Props, "searchParams">) {
  const { token } = await searchParams;
  const hero = (
    <StatusHero icon={Clock} tone="warning" title="This link has expired">
      Verification links work for 24 hours. Ask for a new one to finish setting up your account.
    </StatusHero>
  );
  if (typeof token !== "string") {
    return (
      <>
        {hero}
        <Link href="/login?next=/verify-email" className={`${buttonClass.primary} w-full`}>Log in to get a new link</Link>
      </>
    );
  }
  return (
    <ResendPanel
      action={resendFromExpiredLink.bind(null, token)}
      label="Send a new link"
      primary
      sentNote="If it’s not there, look in your spam folder."
    >
      {hero}
    </ResendPanel>
  );
}

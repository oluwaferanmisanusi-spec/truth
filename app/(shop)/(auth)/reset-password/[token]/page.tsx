// Set a new password (Figma 3.5), or This link has expired (3.6).
import { Suspense } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { BrandBar } from "@/components/shop/bars";
import { StatusHero } from "@/components/shop/status-hero";
import { buttonClass } from "@/components/ui";
import { readToken } from "@/lib/auth/tokens";
import { NewPasswordForm } from "../../forms";
import { Intro } from "../../intro";

type Props = PageProps<"/reset-password/[token]">;

export default function ResetPasswordPage({ params }: Props) {
  return (
    <>
      <BrandBar />
      <main className="flex flex-col gap-6 px-4 py-6">
        <Suspense>
          <Reset params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Reset({ params }: Pick<Props, "params">) {
  const { token } = await params;
  const found = await readToken(token, "reset_password");
  if (found.state !== "valid") {
    return (
      <>
        <div className="pt-4">
          <StatusHero icon={Clock} tone="warning" title="This link has expired">
            Reset links work for 1 hour. Ask for a new one to set your password.
          </StatusHero>
        </div>
        <Link href="/forgot-password" className={`${buttonClass.primary} w-full`}>Send a new link</Link>
      </>
    );
  }
  return (
    <>
      <Intro title="Set a new password">Choose a password you don’t use anywhere else.</Intro>
      <NewPasswordForm token={token} />
    </>
  );
}

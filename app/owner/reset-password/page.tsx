import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getOwner } from "@/lib/auth/owner";
import { AuthCard } from "@/components/owner/auth-card";
import { buttonClass } from "@/components/ui";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Set a new password" };

// Where the owner's reset email lands. Wording from Figma 3.5 / 3.6 (the customer versions).
export default function OwnerResetPasswordPage({ searchParams }: PageProps<"/owner/reset-password">) {
  return (
    <Suspense>
      <ResetPassword searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetPassword({ searchParams }: { searchParams: PageProps<"/owner/reset-password">["searchParams"] }) {
  const { expired } = await searchParams;
  const owner = expired ? null : await getOwner();

  if (!owner) {
    return (
      <AuthCard title="This link has expired" description="Reset links work for 1 hour. Ask for a new one to set your password.">
        <Link href="/owner/forgot-password" className={buttonClass.primary}>
          Send a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password" description="Choose a password you don’t use anywhere else.">
      <NewPasswordForm />
    </AuthCard>
  );
}

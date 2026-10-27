import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/owner/auth-card";
import { buttonClass } from "@/components/ui";
import { api, ApiError } from "@/lib/api/client";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Set a new password" };

type Props = PageProps<"/owner/reset-password/[token]">;

// Where the owner's reset email lands. Wording from Figma 3.5 / 3.6 (the customer versions).
export default function OwnerResetPasswordPage({ params }: Props) {
  return (
    <Suspense>
      <ResetPassword params={params} />
    </Suspense>
  );
}

async function ResetPassword({ params }: Pick<Props, "params">) {
  const { token } = await params;
  const { valid } = await api<{ valid: boolean }>(`/password-resets/${encodeURIComponent(token)}`).catch((error) => {
    // A malformed link is just another link that doesn't work.
    if (error instanceof ApiError && error.status === 400) return { valid: false };
    throw error;
  });

  if (!valid) {
    return (
      <AuthCard title="This link has expired" description="Reset links work once, for 1 hour. Ask for a new one to set your password.">
        <Link href="/owner/forgot-password" className={buttonClass.primary}>
          Send a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password" description="Choose a password you don’t use anywhere else.">
      <NewPasswordForm token={token} />
    </AuthCard>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/owner";
import { logOut } from "../../login/actions";

export const metadata: Metadata = { title: "Bookings" };

// Placeholder until Figma 5.1 Bookings is built.
export default function OwnerBookingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-10">
      <p className="font-display text-wordmark font-semibold tracking-[-0.3px] text-primary">Truth</p>
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 font-semibold">Bookings</h1>
        <Suspense fallback={<p className="text-ink-muted">&nbsp;</p>}>
          <SignedInAs />
        </Suspense>
      </div>
      <form action={logOut}>
        <button
          type="submit"
          className="rounded-md border border-border-input bg-surface px-5 py-3 font-semibold text-primary hover:bg-primary-tint focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
        >
          Log out
        </button>
      </form>
    </main>
  );
}

async function SignedInAs() {
  const owner = await requireOwner();
  return (
    <p className="text-ink-muted">
      You&apos;re logged in as {owner.email}. The bookings table is the next screen we build.
    </p>
  );
}

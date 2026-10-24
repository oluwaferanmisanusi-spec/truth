"use client";

// The person icon on barber screens opens the log out confirm (Figma 4.15).
import { useState, useTransition } from "react";
import { UserRound } from "lucide-react";
import { Sheet } from "@/components/shop/sheet";
import { buttonClass } from "@/components/ui";

const iconButton =
  "flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-muted " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function AccountMenu({ name, email, logOut }: { name: string; email: string; logOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const close = () => !pending && setOpen(false);
  return (
    <>
      <button type="button" className={iconButton} aria-label="Account" onClick={() => setOpen(true)}>
        <UserRound aria-hidden size={24} />
      </button>
      <Sheet
        open={open}
        onClose={close}
        title="Log out?"
        actions={
          <>
            <button type="button" className={`${buttonClass.primary} w-full`} disabled={pending}
              onClick={() => startTransition(() => logOut())}>
              {pending ? "Logging out…" : "Log out"}
            </button>
            <button type="button" className={`${buttonClass.secondary} w-full`} disabled={pending} onClick={close}>
              Cancel
            </button>
          </>
        }
      >
        You’re logged in as {name} ({email}). Log in again to see your schedule.
      </Sheet>
    </>
  );
}

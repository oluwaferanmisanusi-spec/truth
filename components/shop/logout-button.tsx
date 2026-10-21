"use client";

// "Log out" with its confirm sheet (Figma 3.25, and 3.25b during booking).
import { useState, useTransition } from "react";
import { Sheet } from "@/components/shop/sheet";
import { buttonClass } from "@/components/ui";

export function LogoutButton({ action, message }: { action: () => Promise<void>; message: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button type="button" className={buttonClass.ghost} onClick={() => setOpen(true)}>
        Log out
      </button>
      <Sheet
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Log out?"
        actions={
          <>
            <button type="button" className={`${buttonClass.primary} w-full`} disabled={pending}
              onClick={() => startTransition(() => action())}>
              {pending ? "Logging out…" : "Log out"}
            </button>
            <button type="button" className={`${buttonClass.secondary} w-full`} disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </>
        }
      >
        {message}
      </Sheet>
    </>
  );
}

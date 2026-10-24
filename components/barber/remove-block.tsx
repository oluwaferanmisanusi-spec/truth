"use client";

// The ✕ on a block in the day view, with its confirm sheet (Figma 4.13).
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Sheet } from "@/components/shop/sheet";
import { buttonClass } from "@/components/ui";

export function RemoveBlockButton({ what, remove }: {
  /** e.g. "12:00 to 13:00 (Lunch) on Wed 14 Oct" */
  what: string;
  remove: () => Promise<{ error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Remove block, ${what}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface focus-visible:outline-3 focus-visible:outline-focus"
      >
        <X aria-hidden size={20} />
      </button>
      <Sheet
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Remove this block?"
        actions={
          <>
            <button type="button" className={`${buttonClass.primary} w-full`} disabled={pending}
              onClick={() => startTransition(async () => setError((await remove()).error))}>
              {pending ? "Removing…" : "Remove block"}
            </button>
            <button type="button" className={`${buttonClass.secondary} w-full`} disabled={pending} onClick={() => setOpen(false)}>
              Keep block
            </button>
          </>
        }
      >
        <p>{what} will open up, and customers will be able to book it.</p>
        {error && <p role="alert" className="mt-2 text-danger">{error}</p>}
      </Sheet>
    </>
  );
}

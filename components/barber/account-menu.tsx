"use client";

// The person icon on barber screens. Barbers are customers too, so it switches to My bookings;
// it also logs out, with the confirm sheet from Figma 4.15.
import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarDays, LogOut, UserRound } from "lucide-react";
import { Sheet } from "@/components/shop/sheet";
import { buttonClass } from "@/components/ui";

const iconButton =
  "flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-muted " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function AccountMenu({ name, email, logOut }: { name: string; email: string; logOut: () => Promise<void> }) {
  const [open, setOpen] = useState<"menu" | "logout" | null>(null);
  const [pending, startTransition] = useTransition();
  // Only close the sheet that asked: going from the menu to the confirm closes the menu too.
  const close = (sheet: "menu" | "logout") => () => !pending && setOpen((o) => (o === sheet ? null : o));
  return (
    <>
      <button type="button" className={iconButton} aria-label="Account" onClick={() => setOpen("menu")}>
        <UserRound aria-hidden size={24} />
      </button>
      <Sheet
        open={open === "menu"}
        onClose={close("menu")}
        title={name || "Your account"}
        actions={
          <>
            <Link href="/bookings" className={`${buttonClass.secondary} w-full`}>
              <CalendarDays aria-hidden size={20} />
              My bookings
            </Link>
            <button type="button" className={`${buttonClass.secondary} w-full`} onClick={() => setOpen("logout")}>
              <LogOut aria-hidden size={20} />
              Log out
            </button>
          </>
        }
      >
        Logged in as {email}. Your bookings as a customer are under My bookings.
      </Sheet>
      <Sheet
        open={open === "logout"}
        onClose={close("logout")}
        title="Log out?"
        actions={
          <>
            <button type="button" className={`${buttonClass.primary} w-full`} disabled={pending}
              onClick={() => startTransition(() => logOut())}>
              {pending ? "Logging out…" : "Log out"}
            </button>
            <button type="button" className={`${buttonClass.secondary} w-full`} disabled={pending} onClick={close("logout")}>
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

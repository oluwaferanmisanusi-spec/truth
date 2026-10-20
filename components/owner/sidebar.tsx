"use client";

// Figma "Sidebar" (6:3468): owner navigation, 240px, plus the log out confirm (5.13).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Calendar, ChartColumn, Scissors, Settings, Users, type LucideIcon } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { buttonClass } from "@/components/ui";
import { logOut } from "@/app/owner/login/actions";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/owner/bookings", label: "Bookings", icon: Calendar },
  { href: "/owner/stats", label: "Stats", icon: ChartColumn },
  { href: "/owner/services", label: "Services", icon: Scissors },
  { href: "/owner/barbers", label: "Barbers", icon: Users },
  { href: "/owner/settings", label: "Shop settings", icon: Settings },
];

export function OwnerSidebar({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();
  const [confirmingLogOut, setConfirmingLogOut] = useState(false);

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-8 border-r border-border bg-surface px-4 py-6">
      <div className="pl-3">
        <p className="font-display text-wordmark font-semibold text-primary">Truth</p>
        <p className="text-caption font-medium text-ink-muted">Owner dashboard</p>
      </div>

      <nav aria-label="Owner" className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2 focus-visible:outline-3 focus-visible:outline-focus ${
                active ? "bg-primary-tint font-semibold text-primary" : "text-ink hover:bg-surface-muted"
              }`}
            >
              <Icon aria-hidden size={20} className={active ? "text-ink" : "text-ink-muted"} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 pl-3">
        <p className="text-small font-medium">{name}</p>
        <p className="truncate text-caption font-medium text-ink-muted" title={email}>
          {email}
        </p>
        <button
          type="button"
          onClick={() => setConfirmingLogOut(true)}
          className="self-start rounded-md py-3 font-semibold text-primary hover:text-primary-hover hover:underline focus-visible:outline-3 focus-visible:outline-focus"
        >
          Log out
        </button>
      </div>

      <Dialog
        open={confirmingLogOut}
        onClose={() => setConfirmingLogOut(false)}
        title="Log out?"
        actions={
          <>
            <button type="button" className={buttonClass.secondary} onClick={() => setConfirmingLogOut(false)}>
              Cancel
            </button>
            <form action={logOut}>
              <button type="submit" className={buttonClass.primary}>
                Log out
              </button>
            </form>
          </>
        }
      >
        <p>You’ll need to log in again to manage the shop.</p>
      </Dialog>
    </aside>
  );
}

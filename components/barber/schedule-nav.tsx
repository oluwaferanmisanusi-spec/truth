// Top of the barber schedule (Figma 4.3, 4.4): wordmark bar, Day/Week switch, and the
// arrows that move between days or weeks.
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Me } from "@api/me";
import { AccountMenu } from "@/components/barber/account-menu";
import { logOut } from "@/app/barber/actions";

export function BarberBar({ account }: { account: Me }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border pr-1 pl-4">
      <Link href="/barber" className="font-display text-wordmark text-primary">
        Truth
      </Link>
      <AccountMenu name={account.fullName} email={account.email} logOut={logOut} />
    </header>
  );
}

export function ViewTabs({ view, date }: { view: "day" | "week"; date: string }) {
  const tabs = [
    { key: "day", label: "Day", href: `/barber?date=${date}` },
    { key: "week", label: "Week", href: `/barber/week?date=${date}` },
  ] as const;
  return (
    <nav aria-label="Schedule view" className="grid grid-cols-2 gap-1 rounded-md bg-surface-muted p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === view ? "page" : undefined}
          className={`flex h-10 items-center justify-center rounded-sm text-small font-medium focus-visible:outline-3 focus-visible:outline-focus ${
            t.key === view ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

const arrow =
  "flex size-11 items-center justify-center rounded-full hover:bg-surface-muted " +
  "focus-visible:outline-3 focus-visible:outline-focus";

/** "‹  Wed 14 Oct / Today  ›" */
export function PeriodNav({ title, subtitle, prev, next }: {
  title: string;
  subtitle?: string;
  prev: { href: string; label: string };
  next: { href: string; label: string };
}) {
  return (
    <div className="flex items-center">
      <Link href={prev.href} className={arrow} aria-label={prev.label}>
        <ChevronLeft aria-hidden size={24} />
      </Link>
      <div className="flex flex-1 flex-col items-center" aria-live="polite">
        <h1 className="font-sans text-h3 font-semibold tracking-normal">{title}</h1>
        {subtitle && <p className="text-caption text-ink-muted">{subtitle}</p>}
      </div>
      <Link href={next.href} className={arrow} aria-label={next.label}>
        <ChevronRight aria-hidden size={24} />
      </Link>
    </div>
  );
}

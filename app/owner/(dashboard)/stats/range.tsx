"use client";

// From/To for the Stats screen. Changes go in the URL, like the Bookings filters.
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { DateField } from "@/components/owner/filter-field";

export function StatsRange({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const go = (nextFrom: string, nextTo: string) => {
    if (!nextFrom || !nextTo) return;
    const params = new URLSearchParams({ from: nextFrom, to: nextTo < nextFrom ? nextFrom : nextTo });
    startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
  };

  return (
    <div className={`flex items-end gap-4 ${pending ? "opacity-70" : ""}`} aria-busy={pending}>
      <DateField id="stats-from" label="From" value={from} className="w-55" onChange={(v) => go(v, to)} />
      <DateField id="stats-to" label="To" value={to} min={from} className="w-55" onChange={(v) => go(from, v)} />
    </div>
  );
}

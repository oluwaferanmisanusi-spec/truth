import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/owner/page-header";
import { formatNaira } from "@/lib/format";
import { getStats, parseStatsRange } from "@/lib/owner/stats";
import { StatsRange } from "./range";

export const metadata: Metadata = { title: "Stats" };

// Figma 5.4 Stats (7:4075) and 5.4b No bookings in range (58:6477).
export default function OwnerStatsPage({ searchParams }: PageProps<"/owner/stats">) {
  return (
    <>
      <PageHeader
        title="Stats"
        description="How the shop performed over the dates you choose. Every figure comes from bookings made in the app."
      />
      <Suspense fallback={<p className="text-small text-ink-muted">Loading stats…</p>}>
        <StatsResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const percent = (rate: number | null) => (rate === null ? "–" : `${(rate * 100).toFixed(1)}%`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

async function StatsResults({ searchParams }: { searchParams: PageProps<"/owner/stats">["searchParams"] }) {
  await connection(); // the default range depends on today's date
  const range = parseStatsRange(await searchParams);
  const stats = await getStats(range);

  return (
    <>
      <StatsRange from={range.from} to={range.to} />

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Online booking revenue" value={formatNaira(stats.revenueKobo)} detail="Paid in the app, after refunds" />
        <StatCard
          label="Refunds"
          value={formatNaira(stats.refundsKobo)}
          detail={stats.cancelled ? plural(stats.cancelled, "cancelled booking", "cancelled bookings") : "No cancelled bookings"}
        />
        <StatCard
          label="Bookings"
          value={String(stats.bookings)}
          detail={!stats.bookings ? "No bookings" : stats.cancelled ? `Includes ${stats.cancelled} cancelled` : "None cancelled"}
        />
        <StatCard
          label="No-show rate"
          value={percent(stats.noShowRate)}
          detail={stats.appointments ? `${stats.noShows} of ${plural(stats.appointments, "appointment", "appointments")}` : "No appointments yet"}
        />
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="by-barber">
        <h2 id="by-barber" className="text-h2 font-semibold">
          By barber
        </h2>
        {stats.barbers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary-tint text-primary">
              <Calendar aria-hidden size={24} />
            </div>
            <p className="font-display text-h2 font-semibold">No bookings in these dates</p>
            <p className="text-ink-muted">Choose a different date range. Stats count bookings made in the app.</p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <table className="w-full table-fixed border-collapse text-small">
                <colgroup>
                  <col className="w-74" />
                  <col className="w-39" />
                  <col className="w-39" />
                  <col className="w-39" />
                  <col className="w-39" />
                  <col />
                </colgroup>
                <thead className="bg-surface-muted text-caption font-medium text-ink-muted">
                  <tr className="h-10 border-b border-border text-right">
                    <th scope="col" className="py-2 pr-2 pl-5 text-left font-medium">Barber</th>
                    <th scope="col" className="px-2 py-2 font-medium">Appointments</th>
                    <th scope="col" className="px-2 py-2 font-medium">Completed</th>
                    <th scope="col" className="px-2 py-2 font-medium">No-shows</th>
                    <th scope="col" className="px-2 py-2 font-medium">No-show rate</th>
                    <th scope="col" className="py-2 pr-5 pl-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="text-right tabular-nums">
                  {stats.barbers.map((b) => (
                    <tr key={b.id} className="h-16 border-b border-border last:border-b-0">
                      <th scope="row" className="py-3 pr-2 pl-5 text-left font-medium">
                        <span className="flex items-center gap-3">
                          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                            {initials(b.name)}
                          </span>
                          {b.name}
                        </span>
                      </th>
                      <td className="px-2 py-3">{b.appointments}</td>
                      <td className="px-2 py-3">{b.completed}</td>
                      <td className="px-2 py-3">{b.noShows}</td>
                      <td className="px-2 py-3 font-medium">{percent(b.noShowRate)}</td>
                      <td className="py-3 pr-5 pl-2 font-medium">{formatNaira(b.revenueKobo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-caption font-medium text-ink-muted">
              No-show rate = no-shows ÷ appointments that took place (completed + no-shows). Cancelled bookings aren’t
              counted as appointments.
            </p>
          </>
        )}
      </section>
    </>
  );
}

// Figma "Stat card" (6:3509).
function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-5">
      <p className="text-small font-medium text-ink-muted">{label}</p>
      <p className="font-display text-display font-semibold tabular-nums">{value}</p>
      <p className="text-caption font-medium text-ink-muted">{detail}</p>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
